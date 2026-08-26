const crypto = require('node:crypto');
const { evaluateStudentEligibility } = require('./eligibilityService');
const { calculateWeightedScore } = require('../ranking/weightedScore');
const { mergeSortCandidates } = require('../ranking/mergeSort');
const { heapTopK } = require('../ranking/heapTopK');
const { TIE_BREAK_RULE } = require('../ranking/candidateComparator');

function createDeterministicRankingId(driveId, graphVersion, algorithm) {
  const bytes = crypto.createHash('sha1')
    .update(`${driveId}:${graphVersion}:${algorithm}`)
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createShortlist(orderedCandidates, k) {
  return orderedCandidates.slice(0, Math.max(0, Math.min(k, orderedCandidates.length)));
}

class RankingService {
  constructor(profileRegistry) {
    this.profileRegistry = profileRegistry;
  }

  evaluateDriveCandidates(driveId) {
    const drive = this.profileRegistry.getDrive(driveId);
    if (!drive) {
      throw new Error(`Drive not found: ${driveId}`);
    }

    return [...this.profileRegistry.students.values()].map((student) =>
      evaluateStudentEligibility(student, drive)
    );
  }

  computeRanking({ driveId, algorithm = 'WEIGHTED_SCORE', topK } = {}) {
    const drive = this.profileRegistry.getDrive(driveId);
    if (!drive) {
      throw new Error(`Drive not found: ${driveId}`);
    }
    if (!['WEIGHTED_SCORE', 'MERGE_SORT', 'HEAP_TOPK'].includes(algorithm)) {
      throw new Error(`Unsupported ranking algorithm: ${algorithm}`);
    }

    const evaluatedCandidates = [...this.profileRegistry.students.values()].map((student) => ({
      student,
      eligibility: evaluateStudentEligibility(student, drive)
    }));
    const scoredCandidates = evaluatedCandidates
      .filter(({ eligibility }) => eligibility.status === 'ELIGIBLE')
      .map(({ student }) => calculateWeightedScore(student, drive));
    const ordered = mergeSortCandidates(scoredCandidates);
    const selected = algorithm === 'HEAP_TOPK'
      ? heapTopK(scoredCandidates, topK ?? scoredCandidates.length)
      : ordered;
    const orderedCandidates = selected.map((candidate, index) => ({
      student_id: candidate.student_id,
      score: candidate.score,
      rank: index + 1
    }));

    return {
      ranking_id: createDeterministicRankingId(driveId, this.profileRegistry.graph_version, algorithm),
      ordered_candidates: orderedCandidates,
      total_score: orderedCandidates.reduce((sum, candidate) => sum + candidate.score, 0),
      algorithm,
      graph_version: this.profileRegistry.graph_version,
      tie_break_rule: TIE_BREAK_RULE,
      explored_candidate_count: evaluatedCandidates.length
    };
  }
}

module.exports = {
  RankingService,
  createShortlist,
  createDeterministicRankingId
};
