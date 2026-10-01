import assert from 'node:assert/strict';
import test from 'node:test';
import { dummyDrives, dummyStudents } from '../src/data/dummyProfiles';
import { calculateWeightedScore } from '../src/ranking/weightedScore';
import { mergeSortCandidates } from '../src/ranking/mergeSort';
import { evaluateStudentEligibility } from '../src/services/eligibilityService';
import { ProfileRegistryService } from '../src/services/profileRegistryService';
import { createShortlist, RankingService } from '../src/services/rankingService';

function createRegistry(): ProfileRegistryService { const registry = new ProfileRegistryService(); for (const student of dummyStudents) registry.addOrUpdateStudent(student); for (const drive of dummyDrives) registry.addOrUpdateDrive(drive); return registry; }

test('B2 evaluates eligibility using existing drive criteria', () => {
  const drive = dummyDrives[0];
  assert.deepEqual(evaluateStudentEligibility(dummyStudents[0], drive), { student_id: 'S001', status: 'ELIGIBLE', reasons: [] });
  assert.equal(evaluateStudentEligibility(dummyStudents[1], drive).status, 'NOT_ELIGIBLE');
  assert.match(evaluateStudentEligibility(dummyStudents[1], drive).reasons[0], /Missing required skill/);
  assert.deepEqual(evaluateStudentEligibility({ ...dummyStudents[0], cgpa: 6.9 }, drive).reasons, ['CGPA below cutoff']);
  assert.deepEqual(evaluateStudentEligibility({ ...dummyStudents[0], backlogs: 2 }, drive).reasons, ['Backlog restriction']);
});
test('B2 ranks eligible candidates by weighted score with a deterministic tie-break', () => {
  const service = new RankingService(createRegistry());
  const result = service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' });
  assert.deepEqual(result.ordered_candidates.map((candidate) => candidate.student_id), ['S004', 'S001', 'S003']);
  assert.equal(result.ranking_id, service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' }).ranking_id);
  assert.deepEqual(mergeSortCandidates([{ student_id: 'S011', score: 90, cgpa: 8.5 }, { student_id: 'S010', score: 90, cgpa: 8.5 }, { student_id: 'S012', score: 90, cgpa: 8.8 }]).map((candidate) => candidate.student_id), ['S012', 'S010', 'S011']);
});
test('B2 produces consistent WEIGHTED_SCORE, MERGE_SORT, and HEAP_TOPK results', () => {
  const service = new RankingService(createRegistry());
  const weighted = service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' });
  const merged = service.computeRanking({ driveId: 'D001', algorithm: 'MERGE_SORT' });
  const heap = service.computeRanking({ driveId: 'D001', algorithm: 'HEAP_TOPK', topK: 3 });
  assert.deepEqual(weighted.ordered_candidates, merged.ordered_candidates);
  assert.deepEqual(weighted.ordered_candidates, heap.ordered_candidates);
  assert.equal(calculateWeightedScore(dummyStudents[0], dummyDrives[0]).score, 96.2);
});
test('B2 shortlist handles K boundaries and zero eligible candidates', () => {
  const service = new RankingService(createRegistry());
  const ranked = service.computeRanking({ driveId: 'D001' }).ordered_candidates;
  assert.equal(createShortlist(ranked, 2).length, 2); assert.equal(createShortlist(ranked, ranked.length).length, 3); assert.equal(createShortlist(ranked, 10).length, 3); assert.deepEqual(createShortlist([], 3), []);
  const noCandidatesRegistry = new ProfileRegistryService();
  noCandidatesRegistry.addOrUpdateStudent(dummyStudents[1]); noCandidatesRegistry.addOrUpdateDrive(dummyDrives[0]);
  assert.deepEqual(new RankingService(noCandidatesRegistry).computeRanking({ driveId: 'D001' }).ordered_candidates, []);
});
