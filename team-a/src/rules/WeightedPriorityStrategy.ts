import { IRuleEngine, RuleEvaluationResult } from './IRuleEngine';
import { Student, DriveCriteria, EligibilityResult } from '../types';

export class WeightedPriorityStrategy implements IRuleEngine {
  public readonly strategyName = 'WEIGHTED_PRIORITY';

  // Rule weights summing to 100
  private weights = {
    cgpa: 30,
    backlogs: 25,
    branch: 20,
    attendance: 15,
    skills: 10
  };

  public evaluate(student: Student, criteria: DriveCriteria): RuleEvaluationResult {
    const startTime = process.hrtime.bigint();
    const failedRules: string[] = [];
    let score = 0;
    let rulesEvaluated = 5;

    // Hard Constraint 1: Branch
    const branchAllowed = criteria.allowed_branches.some(
      b => b.trim().toUpperCase() === student.branch.trim().toUpperCase()
    );
    if (branchAllowed) {
      score += this.weights.branch;
    } else {
      failedRules.push('BRANCH_NOT_ALLOWED');
    }

    // Hard Constraint 2: Backlogs
    if (student.backlogs <= criteria.max_backlogs) {
      score += this.weights.backlogs;
    } else {
      failedRules.push('BACKLOGS_EXCEEDED');
    }

    // Constraint 3: CGPA (graduated scoring)
    if (student.cgpa >= criteria.min_cgpa) {
      score += this.weights.cgpa;
    } else if (student.cgpa >= criteria.min_cgpa - 0.3) {
      // Borderline CGPA within 0.3
      score += this.weights.cgpa * 0.7;
      failedRules.push('CGPA_BORDERLINE');
    } else {
      failedRules.push('CGPA_BELOW_CUTOFF');
    }

    // Constraint 4: Attendance (graduated scoring)
    if (student.attendance >= criteria.min_attendance) {
      score += this.weights.attendance;
    } else if (student.attendance >= criteria.min_attendance - 10) {
      // Borderline attendance within 10%
      score += this.weights.attendance * 0.6;
      failedRules.push('ATTENDANCE_BORDERLINE');
    } else {
      failedRules.push('ATTENDANCE_BELOW_MINIMUM');
    }

    // Constraint 5: Skills (partial credit)
    const studentSkills = new Set((student.skill_tags || []).map(s => s.toLowerCase().trim()));
    const requiredSkills = criteria.required_skill_tags || [];
    if (requiredSkills.length === 0) {
      score += this.weights.skills;
    } else {
      const matched = requiredSkills.filter(s => studentSkills.has(s.toLowerCase().trim())).length;
      const ratio = matched / requiredSkills.length;
      score += this.weights.skills * ratio;
      if (ratio < 1.0) {
        failedRules.push(ratio >= 0.5 ? 'SKILLS_PARTIALLY_MATCHED' : 'MISSING_REQUIRED_SKILLS');
      }
    }

    // Determine result
    let result: EligibilityResult = 'NOT_ELIGIBLE';
    const hasFatalFailure =
      failedRules.includes('BRANCH_NOT_ALLOWED') ||
      failedRules.includes('BACKLOGS_EXCEEDED') ||
      failedRules.includes('CGPA_BELOW_CUTOFF');

    if (!hasFatalFailure) {
      if (score >= 90 && failedRules.length === 0) {
        result = 'ELIGIBLE';
      } else if (score >= 70) {
        result = 'CONDITIONAL';
      }
    }

    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - startTime) / 1_000_000;

    return {
      result,
      failedRules,
      score: Math.round(score * 10) / 10,
      rulesEvaluated,
      evaluationTimeMs: Math.max(0.01, elapsedMs),
      strategy: this.strategyName,
      metadata: { totalWeightScore: score, passingThreshold: 70 }
    };
  }
}
