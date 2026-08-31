import type { ComparableCandidate } from '../types';

export const TIE_BREAK_RULE = 'HIGHER_CGPA_THEN_STUDENT_ID_ASCENDING';

export function compareCandidates(left: ComparableCandidate, right: ComparableCandidate): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.cgpa !== right.cgpa) return right.cgpa - left.cgpa;
  return left.student_id.localeCompare(right.student_id);
}
