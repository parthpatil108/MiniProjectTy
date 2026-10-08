import type { CandidateScore, Drive, Student } from '../types';

function roundToTwoDecimals(value: number): number { return Math.round(value * 100) / 100; }

export function validateSkillWeightage(drive: Drive): void {
  const requiredSkills = drive.criteria.required_skill_tags;
  let totalWeight = 0;
  for (const skill of requiredSkills) {
    const weight = drive.skill_weightage[skill];
    if (typeof weight !== 'number' || !Number.isFinite(weight)) throw new Error(`Weight for required skill ${skill} must be a finite number.`);
    if (weight < 0) throw new Error(`Weight for required skill ${skill} must not be negative.`);
    totalWeight += weight;
  }
  if (totalWeight !== 100) throw new Error(`Required skill weights must total 100; received ${totalWeight}.`);
}

export function calculateWeightedScore(student: Student, drive: Drive): CandidateScore {
  validateSkillWeightage(drive);
  const requiredSkills = drive.criteria.required_skill_tags;
  const matchedWeight = requiredSkills.reduce((sum, skill) => sum + (student.skill_tags.includes(skill) ? drive.skill_weightage[skill] : 0), 0);
  const skillScore = matchedWeight;
  const cgpaScore = (student.cgpa / 10) * 100;
  const projectScore = student.project_score;
  const score = (skillScore * 0.7) + (cgpaScore * 0.2) + (projectScore * 0.1);
  return { student_id: student.student_id, score: roundToTwoDecimals(score), cgpa: student.cgpa, score_breakdown: { skill_score: roundToTwoDecimals(skillScore), cgpa_score: roundToTwoDecimals(cgpaScore), project_score: projectScore } };
}
