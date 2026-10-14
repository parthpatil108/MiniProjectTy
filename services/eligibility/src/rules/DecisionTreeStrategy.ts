import { IRuleEngine, RuleEvaluationResult } from './IRuleEngine';
import { Student, DriveCriteria, EligibilityResult } from '../types';

export class DecisionTreeStrategy implements IRuleEngine {
  public readonly strategyName = 'DECISION_TREE';

  public evaluate(student: Student, criteria: DriveCriteria): RuleEvaluationResult {
    const startTime = process.hrtime.bigint();
    const failedRules: string[] = [];
    let rulesEvaluated = 0;
    let result: EligibilityResult = 'NOT_ELIGIBLE';
    let decisionPath: string[] = [];

    const normBranch = student.branch.trim().toUpperCase();
    const allowedUpper = criteria.allowed_branches.map(b => b.trim().toUpperCase());
    const isPrimaryCS = ['CSE', 'IT', 'CS', 'AIDS', 'AIML'].includes(normBranch);
    const isAllowed = allowedUpper.includes(normBranch);

    rulesEvaluated++;
    // Tree Level 1: Branch Eligibility
    if (!isAllowed) {
      failedRules.push('BRANCH_NOT_ALLOWED');
      decisionPath.push('branch_rejected');
      return this.conclude(result, failedRules, rulesEvaluated, decisionPath, startTime);
    }
    decisionPath.push('branch_allowed');

    // Tree Level 2: Core Branch vs Allied Branch Sub-tree
    if (isPrimaryCS) {
      decisionPath.push('primary_branch_path');
      rulesEvaluated++;
      // Level 3: Backlog Check
      if (student.backlogs === 0) {
        decisionPath.push('zero_backlogs');
        rulesEvaluated++;
        // Level 4: Standard CGPA
        if (student.cgpa >= criteria.min_cgpa) {
          decisionPath.push('cgpa_qualified');
          rulesEvaluated++;
          // Level 5: Attendance & Skills
          const attOk = student.attendance >= criteria.min_attendance;
          const studentSkills = new Set((student.skill_tags || []).map(s => s.toLowerCase().trim()));
          const missingSkills = (criteria.required_skill_tags || []).filter(
            s => !studentSkills.has(s.toLowerCase().trim())
          );

          if (attOk && missingSkills.length === 0) {
            result = 'ELIGIBLE';
            decisionPath.push('full_match_eligible');
          } else if (attOk && missingSkills.length === 1) {
            result = 'CONDITIONAL';
            failedRules.push('MISSING_ONE_SKILL');
            decisionPath.push('minor_skill_gap_conditional');
          } else if (!attOk && student.attendance >= criteria.min_attendance - 5 && missingSkills.length === 0) {
            result = 'CONDITIONAL';
            failedRules.push('ATTENDANCE_BORDERLINE');
            decisionPath.push('minor_attendance_gap_conditional');
          } else {
            if (!attOk) failedRules.push('ATTENDANCE_BELOW_MINIMUM');
            if (missingSkills.length > 0) failedRules.push('MISSING_REQUIRED_SKILLS');
            result = 'NOT_ELIGIBLE';
            decisionPath.push('secondary_checks_failed');
          }
        } else if (student.cgpa >= criteria.min_cgpa - 0.3) {
          // Compensatory path: High skills compensation
          rulesEvaluated++;
          const studentSkills = new Set((student.skill_tags || []).map(s => s.toLowerCase().trim()));
          const hasAllSkills = (criteria.required_skill_tags || []).every(s => studentSkills.has(s.toLowerCase().trim()));
          if (hasAllSkills && student.attendance >= 85) {
            result = 'CONDITIONAL';
            failedRules.push('CGPA_BORDERLINE_COMPENSATED');
            decisionPath.push('cgpa_compensated_by_skills_and_attendance');
          } else {
            failedRules.push('CGPA_BELOW_CUTOFF');
            decisionPath.push('cgpa_uncompensated_rejection');
          }
        } else {
          failedRules.push('CGPA_BELOW_CUTOFF');
          decisionPath.push('cgpa_substantially_below');
        }
      } else if (student.backlogs === 1) {
        decisionPath.push('single_backlog_path');
        rulesEvaluated++;
        // Exceptional candidate waiver path: CGPA >= cutoff + 1.0 and high attendance
        if (student.cgpa >= criteria.min_cgpa + 1.0 && student.attendance >= 85) {
          result = 'CONDITIONAL';
          failedRules.push('SINGLE_BACKLOG_WAIVER');
          decisionPath.push('single_backlog_exceptional_cgpa_waiver');
        } else {
          failedRules.push('BACKLOGS_EXCEEDED');
          decisionPath.push('backlog_rejected');
        }
      } else {
        failedRules.push('BACKLOGS_EXCEEDED');
        decisionPath.push('multiple_backlogs_rejected');
      }
    } else {
      // Allied Branch Sub-tree
      decisionPath.push('allied_branch_path');
      rulesEvaluated++;
      if (student.backlogs > criteria.max_backlogs) {
        failedRules.push('BACKLOGS_EXCEEDED');
        decisionPath.push('allied_backlogs_exceeded');
      } else {
        const studentSkills = new Set((student.skill_tags || []).map(s => s.toLowerCase().trim()));
        const hasAllSkills = (criteria.required_skill_tags || []).every(s => studentSkills.has(s.toLowerCase().trim()));

        rulesEvaluated++;
        if (student.cgpa >= criteria.min_cgpa + 0.5 && hasAllSkills && student.attendance >= criteria.min_attendance) {
          result = 'ELIGIBLE';
          decisionPath.push('allied_high_merit_eligible');
        } else if (student.cgpa >= criteria.min_cgpa && hasAllSkills && student.attendance >= criteria.min_attendance) {
          result = 'CONDITIONAL';
          failedRules.push('ALLIED_BRANCH_CONDITIONAL');
          decisionPath.push('allied_standard_merit_conditional');
        } else {
          if (student.cgpa < criteria.min_cgpa) failedRules.push('CGPA_BELOW_CUTOFF');
          if (!hasAllSkills) failedRules.push('MISSING_REQUIRED_SKILLS');
          if (student.attendance < criteria.min_attendance) failedRules.push('ATTENDANCE_BELOW_MINIMUM');
          decisionPath.push('allied_criteria_not_met');
        }
      }
    }

    return this.conclude(result, failedRules, rulesEvaluated, decisionPath, startTime);
  }

  private conclude(
    result: EligibilityResult,
    failedRules: string[],
    rulesEvaluated: number,
    decisionPath: string[],
    startTime: bigint
  ): RuleEvaluationResult {
    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - startTime) / 1_000_000;

    return {
      result,
      failedRules,
      score: result === 'ELIGIBLE' ? 100 : result === 'CONDITIONAL' ? 75 : 30,
      rulesEvaluated,
      evaluationTimeMs: Math.max(0.01, elapsedMs),
      strategy: this.strategyName,
      metadata: { decisionPath: decisionPath.join(' -> ') }
    };
  }
}
