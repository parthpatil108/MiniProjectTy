import { SequentialAndStrategy } from '../../src/rules/SequentialAndStrategy';
import { WeightedPriorityStrategy } from '../../src/rules/WeightedPriorityStrategy';
import { DecisionTreeStrategy } from '../../src/rules/DecisionTreeStrategy';
import { RuleEvaluator } from '../../src/rules/RuleEvaluator';
import { Student, DriveCriteria } from '../../src/types';

const defaultCriteria: DriveCriteria = {
  min_cgpa: 7.5,
  max_backlogs: 0,
  allowed_branches: ['CSE', 'IT', 'ECE'],
  min_attendance: 75.0,
  required_skill_tags: ['TypeScript', 'Algorithms']
};

const eligibleStudent: Student = {
  student_id: 'STU-1001',
  name: 'Rahul Sharma',
  branch: 'CSE',
  cgpa: 8.5,
  backlogs: 0,
  attendance: 90.0,
  skill_tags: ['TypeScript', 'Algorithms', 'Node.js']
};

describe('Team A - Rule Engine Subsystem', () => {
  describe('SequentialAndStrategy', () => {
    const strategy = new SequentialAndStrategy();

    it('should mark student ELIGIBLE when meeting all criteria', () => {
      const res = strategy.evaluate(eligibleStudent, defaultCriteria);
      expect(res.result).toBe('ELIGIBLE');
      expect(res.failedRules).toHaveLength(0);
      expect(res.score).toBe(100);
      expect(res.evaluationTimeMs).toBeGreaterThan(0);
    });

    it('should reject student when CGPA is below cutoff', () => {
      const lowCgpaStudent = { ...eligibleStudent, cgpa: 7.2 };
      const res = strategy.evaluate(lowCgpaStudent, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('CGPA_BELOW_CUTOFF');
    });

    it('should reject student when backlogs exceed limit', () => {
      const backlogStudent = { ...eligibleStudent, backlogs: 1 };
      const res = strategy.evaluate(backlogStudent, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('BACKLOGS_EXCEEDED');
    });

    it('should reject student with disallowed branch', () => {
      const mechStudent = { ...eligibleStudent, branch: 'CIVIL' };
      const res = strategy.evaluate(mechStudent, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('BRANCH_NOT_ALLOWED');
    });

    it('should reject student with low attendance', () => {
      const lowAttStudent = { ...eligibleStudent, attendance: 65.0 };
      const res = strategy.evaluate(lowAttStudent, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('ATTENDANCE_BELOW_MINIMUM');
    });

    it('should reject student missing required skills', () => {
      const missingSkillsStudent = { ...eligibleStudent, skill_tags: ['Python'] };
      const res = strategy.evaluate(missingSkillsStudent, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('MISSING_REQUIRED_SKILLS');
    });
  });

  describe('WeightedPriorityStrategy', () => {
    const strategy = new WeightedPriorityStrategy();

    it('should grant ELIGIBLE for high-scoring applicants', () => {
      const res = strategy.evaluate(eligibleStudent, defaultCriteria);
      expect(res.result).toBe('ELIGIBLE');
      expect(res.score).toBeGreaterThanOrEqual(90);
    });

    it('should grant CONDITIONAL when core academic passes but attendance is borderline', () => {
      // Attendance is 70% (criteria is 75%, within 10% tolerance)
      const borderlineStudent: Student = {
        ...eligibleStudent,
        attendance: 70.0
      };
      const res = strategy.evaluate(borderlineStudent, defaultCriteria);
      expect(res.result).toBe('CONDITIONAL');
      expect(res.failedRules).toContain('ATTENDANCE_BORDERLINE');
    });

    it('should return NOT_ELIGIBLE if branch or backlogs fail', () => {
      const student = { ...eligibleStudent, backlogs: 2 };
      const res = strategy.evaluate(student, defaultCriteria);
      expect(res.result).toBe('NOT_ELIGIBLE');
      expect(res.failedRules).toContain('BACKLOGS_EXCEEDED');
    });
  });

  describe('DecisionTreeStrategy', () => {
    const strategy = new DecisionTreeStrategy();

    it('should grant ELIGIBLE on core CS primary path', () => {
      const res = strategy.evaluate(eligibleStudent, defaultCriteria);
      expect(res.result).toBe('ELIGIBLE');
      expect(res.metadata?.decisionPath).toContain('primary_branch_path');
    });

    it('should support CONDITIONAL waiver for exceptional CGPA with 1 backlog', () => {
      const exceptionalStudent: Student = {
        ...eligibleStudent,
        cgpa: 9.0, // Criteria min_cgpa is 7.5; 9.0 >= 7.5 + 1.0 waiver threshold
        backlogs: 1,
        attendance: 88.0
      };
      const res = strategy.evaluate(exceptionalStudent, defaultCriteria);
      expect(res.result).toBe('CONDITIONAL');
      expect(res.failedRules).toContain('SINGLE_BACKLOG_WAIVER');
    });

    it('should evaluate allied branches with higher merit requirements', () => {
      const alliedStudent: Student = {
        ...eligibleStudent,
        branch: 'ECE',
        cgpa: 8.2 // 8.2 >= 7.5 + 0.5 allied merit threshold
      };
      const res = strategy.evaluate(alliedStudent, defaultCriteria);
      expect(res.result).toBe('ELIGIBLE');
      expect(res.metadata?.decisionPath).toContain('allied_high_merit_eligible');
    });
  });

  describe('RuleEvaluator', () => {
    const evaluator = new RuleEvaluator();

    it('should correctly build standard EligibilityDecision DTO', () => {
      const decision = evaluator.createDecision(
        'req-12345',
        eligibleStudent,
        defaultCriteria,
        'v1.0.0',
        'SEQUENTIAL_AND',
        42
      );

      expect(decision.decision_id).toBeDefined();
      expect(decision.request_id).toBe('req-12345');
      expect(decision.eligibility_result).toBe('ELIGIBLE');
      expect(decision.failed_rules).toEqual([]);
      expect(decision.lease_id).toBeNull();
      expect(decision.decision_metrics.queue_wait_ms).toBe(42);
      expect(decision.decision_metrics.evaluation_time_ms).toBeGreaterThan(0);
    });

    it('should reject malformed inputs with VALIDATION_ERROR', () => {
      expect(() => {
        evaluator.evaluateDirect({ ...eligibleStudent, cgpa: 15.0 }, defaultCriteria);
      }).toThrow();
    });
  });
});
