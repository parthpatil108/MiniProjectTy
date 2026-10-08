import { v4 as uuidv4 } from 'uuid';
import { QueueManager } from '../queue/QueueManager';
import { RuleEvaluator } from '../rules/RuleEvaluator';
import { MetricsCollector } from '../telemetry/MetricsCollector';
import { EventStream } from '../telemetry/EventStream';
import {
  EligibilityRequest,
  EligibilityDecision,
  Student,
  DriveCriteria,
  RuleChainingStrategy,
  QueuedItem,
  QueuePolicy
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { isValidRuleSetVersion, DEFAULT_DRIVE_CRITERIA } from '../rules/defaultRules';

export class EligibilityService {
  private queueManager: QueueManager;
  private ruleEvaluator: RuleEvaluator;
  private metricsCollector: MetricsCollector;
  private eventStream: EventStream;
  private autoProcess: boolean;

  // In-memory working stores
  private requests: Map<string, EligibilityRequest> = new Map();
  private decisionsByRequestId: Map<string, EligibilityDecision> = new Map();
  private decisionsById: Map<string, EligibilityDecision> = new Map();

  constructor(
    queueManager?: QueueManager,
    ruleEvaluator?: RuleEvaluator,
    metricsCollector?: MetricsCollector,
    eventStream?: EventStream,
    autoProcess: boolean = false
  ) {
    this.queueManager = queueManager || new QueueManager();
    this.ruleEvaluator = ruleEvaluator || new RuleEvaluator();
    this.metricsCollector = metricsCollector || new MetricsCollector();
    this.eventStream = eventStream || new EventStream();
    this.autoProcess = autoProcess;
  }

  public getQueueManager(): QueueManager {
    return this.queueManager;
  }

  public getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  public getEventStream(): EventStream {
    return this.eventStream;
  }

  public submitEligibilityRequest(
    payload: EligibilityRequest,
    studentSnapshot?: Student,
    criteriaSnapshot?: DriveCriteria,
    strategy: RuleChainingStrategy = 'SEQUENTIAL_AND',
    correlationId: string = uuidv4()
  ): {
    request_id: string;
    queue_position: number;
    state: string;
    estimated_evaluation_time_ms: number;
  } {
    // 1. Validate payload
    if (!payload.request_id || !payload.application_id || !payload.student_id || !payload.drive_id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing required eligibility request fields', [
        { field: 'request_id', reason: 'required' },
        { field: 'student_id', reason: 'required' },
        { field: 'drive_id', reason: 'required' }
      ]);
    }

    if (!payload.rule_set_version || !isValidRuleSetVersion(payload.rule_set_version)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Unsupported rule_set_version: ${payload.rule_set_version}`, [
        { field: 'rule_set_version', reason: 'unsupported_version' }
      ]);
    }

    // 2. Idempotency by request_id
    const existing = this.requests.get(payload.request_id);
    if (existing) {
      const position = this.queueManager.getPosition(payload.drive_id, payload.request_id);
      const isEvaluated = this.decisionsByRequestId.has(payload.request_id);
      return {
        request_id: payload.request_id,
        queue_position: position > 0 ? position : 0,
        state: isEvaluated ? 'EVALUATED' : 'QUEUED',
        estimated_evaluation_time_ms: Math.max(5, position * 15)
      };
    }

    // 3. Atomically enqueue
    this.requests.set(payload.request_id, payload);

    const queuedItem: QueuedItem = {
      request: payload,
      studentSnapshot: studentSnapshot || {
        student_id: payload.student_id,
        name: 'Auto Student',
        branch: 'CSE',
        cgpa: 8.0,
        backlogs: 0,
        attendance: 85.0,
        skill_tags: ['TypeScript', 'Node.js']
      },
      criteriaSnapshot: criteriaSnapshot || DEFAULT_DRIVE_CRITERIA,
      strategy,
      enqueued_at: Date.now(),
      effective_priority_score: payload.priority === 'HIGH' ? 100 : 10
    };

    const enqueueResult = this.queueManager.enqueue(payload.drive_id, queuedItem);
    if (!enqueueResult.success) {
      this.requests.delete(payload.request_id);
      throw new AppError(429, 'RATE_LIMITED', 'Queue capacity exceeded for drive', [
        { field: 'drive_id', reason: 'queue_full' }
      ]);
    }

    // 4. Emit SSE notification
    this.eventStream.broadcast({
      event: 'REQUEST_ENQUEUED',
      data: {
        request_id: payload.request_id,
        drive_id: payload.drive_id,
        student_id: payload.student_id,
        priority: payload.priority,
        queue_position: enqueueResult.position,
        correlation_id: correlationId
      },
      timestamp: new Date().toISOString()
    });

    // 5. Process immediately or synchronously evaluate if configured
    if (this.autoProcess) {
      setImmediate(() => {
        try {
          this.processNextInQueue(payload.drive_id, correlationId);
        } catch {
          // Handled internally
        }
      });
    }

    return {
      request_id: payload.request_id,
      queue_position: enqueueResult.position,
      state: 'QUEUED',
      estimated_evaluation_time_ms: enqueueResult.estimatedEvaluationTimeMs
    };
  }

  public processNextInQueue(driveId: string, correlationId: string = uuidv4()): EligibilityDecision | undefined {
    const item = this.queueManager.dequeue(driveId);
    if (!item) return undefined;

    const queueWaitMs = Math.max(1, Date.now() - item.enqueued_at);
    const student = item.studentSnapshot!;
    const criteria = item.criteriaSnapshot || DEFAULT_DRIVE_CRITERIA;
    const strategy = item.strategy || 'SEQUENTIAL_AND';

    const decision = this.ruleEvaluator.createDecision(
      item.request.request_id,
      student,
      criteria,
      item.request.rule_set_version,
      strategy,
      queueWaitMs
    );

    this.decisionsByRequestId.set(item.request.request_id, decision);
    this.decisionsById.set(decision.decision_id, decision);

    this.metricsCollector.recordEvaluation(
      decision.decision_metrics.evaluation_time_ms,
      queueWaitMs,
      item.request.priority
    );
    this.queueManager.updateAverageEvaluationTime(decision.decision_metrics.evaluation_time_ms);

    this.eventStream.broadcast({
      event: 'EVALUATION_COMPLETED',
      data: {
        decision_id: decision.decision_id,
        request_id: item.request.request_id,
        eligibility_result: decision.eligibility_result,
        failed_rules: decision.failed_rules,
        correlation_id: correlationId
      },
      timestamp: new Date().toISOString()
    });

    return decision;
  }

  public getEligibilityRequest(requestId: string): {
    request: EligibilityRequest;
    decision: EligibilityDecision;
  } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new AppError(404, 'NOT_FOUND', `Eligibility request not found: ${requestId}`, [
        { field: 'requestId', reason: 'not_found' }
      ]);
    }

    let decision = this.decisionsByRequestId.get(requestId);
    if (!decision) {
      // If not yet evaluated, evaluate on-demand
      const item = this.queueManager.getOrCreateQueue(request.drive_id).toArray().find(i => i.request.request_id === requestId);
      decision = this.ruleEvaluator.createDecision(
        requestId,
        item?.studentSnapshot || {
          student_id: request.student_id,
          name: 'Auto Student',
          branch: 'CSE',
          cgpa: 8.0,
          backlogs: 0,
          attendance: 85.0,
          skill_tags: ['TypeScript', 'Node.js']
        },
        item?.criteriaSnapshot || DEFAULT_DRIVE_CRITERIA,
        request.rule_set_version,
        item?.strategy || 'SEQUENTIAL_AND',
        10
      );
      this.decisionsByRequestId.set(requestId, decision);
      this.decisionsById.set(decision.decision_id, decision);
    }

    return { request, decision };
  }

  public getDecision(decisionId: string): EligibilityDecision {
    const decision = this.decisionsById.get(decisionId);
    if (!decision) {
      throw new AppError(404, 'NOT_FOUND', `Eligibility decision not found: ${decisionId}`, [
        { field: 'decisionId', reason: 'not_found' }
      ]);
    }
    return decision;
  }

  public getDriveQueue(driveId: string): {
    drive_id: string;
    total_queued: number;
    queue: any[];
  } {
    const queueView = this.queueManager.getQueueView(driveId);
    return {
      drive_id: driveId,
      total_queued: queueView.length,
      queue: queueView
    };
  }

  public evaluateDirect(student: Student, criteria: DriveCriteria, strategy?: RuleChainingStrategy) {
    return this.ruleEvaluator.evaluateDirect(student, criteria, strategy);
  }

  public getMetrics() {
    const activeDepth = this.queueManager.getTotalQueued();
    return this.metricsCollector.getMetrics(activeDepth);
  }

  public setQueuePolicy(driveId: string, policy: QueuePolicy): void {
    this.queueManager.setQueuePolicy(driveId, policy);
  }

  public reset(): void {
    this.requests.clear();
    this.decisionsById.clear();
    this.decisionsByRequestId.clear();
    this.queueManager.clear();
    this.metricsCollector.reset();
  }
}
