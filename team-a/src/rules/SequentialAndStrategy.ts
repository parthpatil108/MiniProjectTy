import { IRuleEngine, RuleEvaluationResult } from './IRuleEngine';
import { Student, DriveCriteria } from '../types';

export class SequentialAndStrategy implements IRuleEngine {
  public readonly strategyName = 'SEQUENTIAL_AND';

  public evaluate(student: Student, criteria: DriveCriteria, options?: { shortCircuit?: boolean }): RuleEvaluationResult {
    const startTime = process.hrtime.bigint();
    const failedRules: string[] = [];
    const shortCircuit = options?.shortCircuit ?? false;
    let rulesEvaluated = 0;

    // Rule 1: CGPA Cutoff
    rulesEvaluated++;
    if (student.cgpa < criteria.min_cgpa) {
      failedRules.push('CGPA_BELOW_CUTOFF');
      if (shortCircuit) return this.buildResult(failedRules, rulesEvaluated, startTime);
    }

    // Rule 2: Backlogs Threshold
    rulesEvaluated++;
    if (student.backlogs > criteria.max_backlogs) {
      failedRules.push('BACKLOGS_EXCEEDED');
      if (shortCircuit) return this.buildResult(failedRules, rulesEvaluated, startTime);
    }

    // Rule 3: Allowed Branches
    rulesEvaluated++;
    const branchAllowed = criteria.allowed_branches.some(
      b => b.trim().toUpperCase() === student.branch.trim().toUpperCase()
    );
    if (!branchAllowed) {
      failedRules.push('BRANCH_NOT_ALLOWED');
      if (shortCircuit) return this.buildResult(failedRules, rulesEvaluated, startTime);
    }

    // Rule 4: Attendance Minimum
    rulesEvaluated++;
    if (student.attendance < criteria.min_attendance) {
      failedRules.push('ATTENDANCE_BELOW_MINIMUM');
      if (shortCircuit) return this.buildResult(failedRules, rulesEvaluated, startTime);
    }

    // Rule 5: Required Skill Tags
    rulesEvaluated++;
    const studentSkillsLower = new Set((student.skill_tags || []).map(s => s.toLowerCase().trim()));
    const missingSkills = (criteria.required_skill_tags || []).filter(
      tag => !studentSkillsLower.has(tag.toLowerCase().trim())
    );
    if (missingSkills.length > 0) {
      failedRules.push('MISSING_REQUIRED_SKILLS');
      if (shortCircuit) return this.buildResult(failedRules, rulesEvaluated, startTime);
    }

    return this.buildResult(failedRules, rulesEvaluated, startTime);
  }

  private buildResult(failedRules: string[], rulesEvaluated: number, startTime: bigint): RuleEvaluationResult {
    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - startTime) / 1_000_000;
    const isEligible = failedRules.length === 0;

    return {
      result: isEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      failedRules,
      score: isEligible ? 100 : Math.max(0, 100 - (failedRules.length * 20)),
      rulesEvaluated,
      evaluationTimeMs: Math.max(0.01, elapsedMs),
      strategy: this.strategyName
    };
  }
}
