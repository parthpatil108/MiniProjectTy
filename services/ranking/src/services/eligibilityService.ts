import type { Drive, EligibilityResult, Student } from '../types';

export function evaluateStudentEligibility(student: Student, drive: Drive): EligibilityResult {
  const reasons: string[] = [];
  const { criteria } = drive;
  if (student.cgpa < criteria.min_cgpa) reasons.push('CGPA below cutoff');
  if (student.backlogs > criteria.max_backlogs) reasons.push('Backlog restriction');
  if (!criteria.allowed_branches.includes(student.branch)) reasons.push('Branch not allowed');
  if (student.attendance < criteria.min_attendance) reasons.push('Attendance below cutoff');
  const missingSkills = criteria.required_skill_tags.filter((skill) => !student.skill_tags.includes(skill));
  if (missingSkills.length > 0) reasons.push(`Missing required skill: ${missingSkills.join(', ')}`);
  return { student_id: student.student_id, status: reasons.length === 0 ? 'ELIGIBLE' : 'NOT_ELIGIBLE', reasons };
}
