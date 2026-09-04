import { v4 as uuidv4 } from 'uuid';
import { IRuleEngine, RuleEvaluationResult } from './IRuleEngine';
import { SequentialAndStrategy } from './SequentialAndStrategy';
import { WeightedPriorityStrategy } from './WeightedPriorityStrategy';
import { DecisionTreeStrategy } from './DecisionTreeStrategy';
import {
  Student,
  DriveCriteria,
  EligibilityDecision,
  RuleChainingStrategy
} from '../types';
import { AppError } from '../middleware/errorHandler';

export class RuleEvaluator {
  private strategies: Map<RuleChainingStrategy, IRuleEngine> = new Map();

  constructor() {
    this.registerStrategy(new SequentialAndStrategy());
    this.registerStrategy(new WeightedPriorityStrategy());
    this.registerStrategy(new DecisionTreeStrategy());
  }

  public registerStrategy(strategy: IRuleEngine): void {
    this.strategies.set(strategy.strategyName as RuleChainingStrategy, strategy);
  }

  public getStrategy(name: RuleChainingStrategy): IRuleEngine {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new AppError(400, 'VALIDATION_ERROR', `Unsupported rule chaining strategy: ${name}`);
    }
    return strategy;
  }

  public evaluateDirect(
    student: Student,
    criteria: DriveCriteria,
    strategyName: RuleChainingStrategy = 'SEQUENTIAL_AND'
  ): RuleEvaluationResult {
    this.validateStudent(student);
    this.validateCriteria(criteria);

    const strategy = this.getStrategy(strategyName);
    return strategy.evaluate(student, criteria);
  }

  public createDecision(
    requestId: string,
    student: Student,
    criteria: DriveCriteria,
    ruleSetVersion: string,
    strategyName: RuleChainingStrategy = 'SEQUENTIAL_AND',
    queueWaitMs: number = 0
  ): EligibilityDecision {
    const evalResult = this.evaluateDirect(student, criteria, strategyName);

    return {
      decision_id: uuidv4(),
      request_id: requestId,
      eligibility_result: evalResult.result,
      failed_rules: evalResult.failedRules,
      rule_set_version: ruleSetVersion,
      lease_id: null,
      decision_metrics: {
        evaluation_time_ms: evalResult.evaluationTimeMs,
        queue_wait_ms: queueWaitMs
      }
    };
  }

  private validateStudent(student: Student): void {
    if (!student || !student.student_id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid student record: student_id is required', [
        { field: 'student_id', reason: 'required' }
      ]);
    }
    if (typeof student.cgpa !== 'number' || student.cgpa < 0 || student.cgpa > 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid student CGPA: must be between 0.0 and 10.0', [
        { field: 'cgpa', reason: 'out_of_bounds' }
      ]);
    }
    if (typeof student.backlogs !== 'number' || student.backlogs < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid student backlogs: must be non-negative integer', [
        { field: 'backlogs', reason: 'out_of_bounds' }
      ]);
    }
  }

  private validateCriteria(criteria: DriveCriteria): void {
    if (!criteria) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Drive criteria is required');
    }
    if (typeof criteria.min_cgpa !== 'number' || criteria.min_cgpa < 0 || criteria.min_cgpa > 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid criteria min_cgpa: must be between 0.0 and 10.0', [
        { field: 'min_cgpa', reason: 'out_of_bounds' }
      ]);
    }
    if (!Array.isArray(criteria.allowed_branches)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'criteria.allowed_branches must be an array', [
        { field: 'allowed_branches', reason: 'invalid_type' }
      ]);
    }
  }
}
