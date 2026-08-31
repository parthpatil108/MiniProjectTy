import type { CandidateScore, Drive, Student } from '../types';

function roundToTwoDecimals(value: number): number { return Math.round(value * 100) / 100; }

export function calculateWeightedScore(student: Student, drive: Drive): CandidateScore {
  const requiredSkills = drive.criteria.required_skill_tags;
  const totalWeight = requiredSkills.reduce((sum, skill) => sum + (drive.skill_weightage[skill] ?? 0), 0);
  const matchedWeight = requiredSkills.reduce((sum, skill) => sum + (student.skill_tags.includes(skill) ? (drive.skill_weightage[skill] ?? 0) : 0), 0);
  const skillScore = totalWeight === 0 ? 0 : (matchedWeight / totalWeight) * 100;
  const cgpaScore = (student.cgpa / 10) * 100;
  const projectScore = student.project_score;
  const score = (skillScore * 0.7) + (cgpaScore * 0.2) + (projectScore * 0.1);
  return { student_id: student.student_id, score: roundToTwoDecimals(score), cgpa: student.cgpa, score_breakdown: { skill_score: roundToTwoDecimals(skillScore), cgpa_score: roundToTwoDecimals(cgpaScore), project_score: projectScore } };
}
