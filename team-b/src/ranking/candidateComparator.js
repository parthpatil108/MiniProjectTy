const TIE_BREAK_RULE = 'HIGHER_CGPA_THEN_STUDENT_ID_ASCENDING';

function compareCandidates(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.cgpa !== right.cgpa) {
    return right.cgpa - left.cgpa;
  }
  return left.student_id.localeCompare(right.student_id);
}

module.exports = { TIE_BREAK_RULE, compareCandidates };
