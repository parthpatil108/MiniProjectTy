import { Student, DriveCriteria, EligibilityResult } from '../types';

export interface RuleEvaluationResult {
  result: EligibilityResult;
  failedRules: string[];
  score: number;
  rulesEvaluated: number;
  evaluationTimeMs: number;
  strategy: string;
  metadata?: Record<string, any>;
}

export interface IRuleEngine {
  readonly strategyName: string;
  evaluate(student: Student, criteria: DriveCriteria, options?: { shortCircuit?: boolean }): RuleEvaluationResult;
}
