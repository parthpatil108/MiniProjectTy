export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RULE_CONFLICT'
  | 'STATE_CONFLICT'
  | 'VERSION_MISMATCH'
  | 'SLOT_UNAVAILABLE'
  | 'LOCK_TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface Meta {
  correlation_id: string;
  api_version: string;
  timestamp?: string;
}

export interface ErrorDetail {
  field?: string;
  reason?: string;
  message?: string;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

export interface ErrorEnvelope {
  error: ErrorBody;
  meta: Meta;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: Meta;
}

export type EligibilityPriority = 'NORMAL' | 'HIGH';

export interface Student {
  student_id: string;
  name?: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  attendance: number;
  skill_tags: string[];
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DriveCriteria {
  min_cgpa: number;
  max_backlogs: number;
  allowed_branches: string[];
  min_attendance: number;
  required_skill_tags: string[];
}

export interface EligibilityRequest {
  request_id: string;
  application_id: string;
  student_id: string;
  drive_id: string;
  rule_set_version: string;
  priority: EligibilityPriority;
  submitted_at: string;
}

export type EligibilityResult = 'ELIGIBLE' | 'CONDITIONAL' | 'NOT_ELIGIBLE';

export interface DecisionMetrics {
  evaluation_time_ms: number;
  queue_wait_ms: number;
}

export interface EligibilityDecision {
  decision_id: string;
  request_id: string;
  eligibility_result: EligibilityResult;
  failed_rules: string[];
  rule_set_version: string;
  lease_id: string | null;
  decision_metrics: DecisionMetrics;
}

export type RuleChainingStrategy = 'SEQUENTIAL_AND' | 'WEIGHTED_PRIORITY' | 'DECISION_TREE';

export type QueuePolicy = 'FIFO' | 'CIRCULAR' | 'PRIORITY' | 'HEAP';

export type RequestState = 'QUEUED' | 'READY' | 'EVALUATED' | 'COMPLETED' | 'REJECTED';

export interface QueuedItem {
  request: EligibilityRequest;
  studentSnapshot?: Student;
  criteriaSnapshot?: DriveCriteria;
  strategy?: RuleChainingStrategy;
  enqueued_at: number;
  effective_priority_score: number; // for aging / starvation avoidance
}

export interface QueueEntryView {
  request_id: string;
  student_id: string;
  priority: EligibilityPriority;
  position: number;
  estimated_wait_ms?: number;
}

export interface EligibilityMetrics {
  total_evaluated: number;
  p95_evaluation_ms: number;
  active_queue_depth: number;
  deadlock_cycles_detected?: number;
  throughput_per_sec: number;
  wait_times_by_priority: {
    HIGH: { avg_wait_ms: number; p95_wait_ms: number; max_wait_ms: number };
    NORMAL: { avg_wait_ms: number; p95_wait_ms: number; max_wait_ms: number };
  };
  starvation_count: number;
}
