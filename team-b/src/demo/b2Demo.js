const { dummyStudents, dummyDrives } = require('../data/dummyProfiles');
const { ProfileRegistryService } = require('../services/profileRegistryService');
const { RankingService, createShortlist } = require('../services/rankingService');

const registry = new ProfileRegistryService();
for (const student of dummyStudents) {
  registry.addOrUpdateStudent(student);
}
for (const drive of dummyDrives) {
  registry.addOrUpdateDrive(drive);
}

const drive = registry.getDrive('D001');
const rankingService = new RankingService(registry);
const eligibilityResults = rankingService.evaluateDriveCandidates(drive.drive_id);
const weightedScoreRanking = rankingService.computeRanking({
  driveId: drive.drive_id,
  algorithm: 'WEIGHTED_SCORE'
});
const shortlist = createShortlist(weightedScoreRanking.ordered_candidates, 2);
const mergeSortRanking = rankingService.computeRanking({
  driveId: drive.drive_id,
  algorithm: 'MERGE_SORT'
});
const heapTopKRanking = rankingService.computeRanking({
  driveId: drive.drive_id,
  algorithm: 'HEAP_TOPK',
  topK: 2
});

console.log('Team B B2: Ranking & Shortlisting Demo');
console.log(`Drive: ${drive.company}`);
console.log(`Required Skills: ${drive.criteria.required_skill_tags.join(', ')}`);
console.log(`Minimum CGPA: ${drive.criteria.min_cgpa}`);
console.log('\nEligibility:');
for (const result of eligibilityResults) {
  const reasonText = result.reasons.length > 0 ? ` — ${result.reasons.join('; ')}` : '';
  console.log(`${result.student_id} → ${result.status}${reasonText}`);
}

console.log('\nWEIGHTED_SCORE Ranking:');
for (const candidate of weightedScoreRanking.ordered_candidates) {
  console.log(`${candidate.rank}. ${candidate.student_id} — ${candidate.score}`);
}
console.log(`Tie-break rule: ${weightedScoreRanking.tie_break_rule}`);

console.log('\nTop-K Shortlist (K=2):');
for (const candidate of shortlist) {
  console.log(`${candidate.rank}. ${candidate.student_id} — ${candidate.score}`);
}

console.log('\nMERGE_SORT Ranking:');
console.log(mergeSortRanking.ordered_candidates.map((candidate) => candidate.student_id).join(', '));
console.log('HEAP_TOPK (K=2):');
console.log(heapTopKRanking.ordered_candidates.map((candidate) => candidate.student_id).join(', '));
