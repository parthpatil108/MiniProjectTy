import crypto from 'node:crypto';
import { evaluateStudentEligibility } from './eligibilityService';
import { calculateWeightedScore, validateSkillWeightage } from '../ranking/weightedScore';
import { mergeSortCandidates } from '../ranking/mergeSort';
import { heapTopK } from '../ranking/heapTopK';
import { TIE_BREAK_RULE } from '../ranking/candidateComparator';
import type { ComputeRankingOptions, OptimizationMetric, RankedCandidate, RankingAlgorithm, RankingConstraints, RankingResult, TopKResult } from '../types';
import type { ProfileRegistryService } from './profileRegistryService';

export function createDeterministicRankingId(driveId: string, graphVersion: string, algorithm: RankingAlgorithm, topK?: number, rankingOptions?: { candidatePool?: string[]; constraints?: RankingConstraints }): string {
  const additionalInputs = rankingOptions && Object.keys(rankingOptions).length > 0 ? `:${JSON.stringify(rankingOptions)}` : '';
  const rankingInput = `${driveId}:${graphVersion}:${algorithm}${topK === undefined ? '' : `:topK:${topK}`}${additionalInputs}`;
  const bytes = crypto.createHash('sha1').update(rankingInput).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createShortlist(orderedCandidates: RankedCandidate[], k: number): TopKResult {
  return orderedCandidates.slice(0, Math.max(0, Math.min(k, orderedCandidates.length)));
}

export class RankingService {
  private readonly results = new Map<string, RankingResult>();
  constructor(private readonly profileRegistry: ProfileRegistryService) {}
  getRanking(rankingId: string): RankingResult | null { return this.results.get(rankingId) ?? null; }
  evaluateDriveCandidates(driveId: string) {
    const drive = this.profileRegistry.getDrive(driveId);
    if (!drive) throw new Error(`Drive not found: ${driveId}`);
    return [...this.profileRegistry.students.values()].map((student) => evaluateStudentEligibility(student, drive));
  }
  computeRanking({ driveId, algorithm = 'WEIGHTED_SCORE', topK, candidatePool, optimizationMetric = 'SCORE_DESC', constraints = {} }: ComputeRankingOptions = {}): RankingResult {
    const drive = this.profileRegistry.getDrive(driveId ?? '');
    if (!drive) throw new Error(`Drive not found: ${driveId}`);
    if (!(['WEIGHTED_SCORE', 'MERGE_SORT', 'HEAP_TOPK'] as RankingAlgorithm[]).includes(algorithm)) throw new Error(`Unsupported ranking algorithm: ${algorithm}`);
    if (optimizationMetric !== 'SCORE_DESC') throw new Error(`Unsupported optimization_metric: ${String(optimizationMetric)}`);
    if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) throw new Error('constraints must be an object.');
    const constraintKeys = Object.keys(constraints);
    const unsupportedConstraints = constraintKeys.filter((key) => !['min_cgpa', 'max_backlogs', 'min_project_score'].includes(key));
    if (unsupportedConstraints.length) throw new Error(`Unsupported ranking constraint(s): ${unsupportedConstraints.sort().join(', ')}`);
    if (constraints.min_cgpa !== undefined && (typeof constraints.min_cgpa !== 'number' || !Number.isFinite(constraints.min_cgpa) || constraints.min_cgpa < 0 || constraints.min_cgpa > 10)) throw new Error('constraints.min_cgpa must be a finite number from 0 to 10.');
    if (constraints.max_backlogs !== undefined && (!Number.isInteger(constraints.max_backlogs) || constraints.max_backlogs < 0)) throw new Error('constraints.max_backlogs must be a non-negative integer.');
    if (constraints.min_project_score !== undefined && (typeof constraints.min_project_score !== 'number' || !Number.isFinite(constraints.min_project_score))) throw new Error('constraints.min_project_score must be a finite number.');
    validateSkillWeightage(drive);
    if (candidatePool !== undefined && (!Array.isArray(candidatePool) || candidatePool.some((id) => typeof id !== 'string' || !id.trim()))) throw new Error('candidate_pool must be an array of non-empty student IDs.');
    const candidateIds = candidatePool === undefined ? [...this.profileRegistry.students.keys()] : [...new Set(candidatePool)].sort();
    const unknownIds = candidateIds.filter((id) => !this.profileRegistry.students.has(id));
    if (unknownIds.length) throw new Error(`Unknown candidate ID(s) in candidate_pool: ${unknownIds.join(', ')}`);
    const candidates = candidateIds.map((id) => this.profileRegistry.students.get(id)!);
    const effectiveDrive = { ...drive, criteria: { ...drive.criteria, min_cgpa: Math.max(drive.criteria.min_cgpa, constraints.min_cgpa ?? drive.criteria.min_cgpa), max_backlogs: Math.min(drive.criteria.max_backlogs, constraints.max_backlogs ?? drive.criteria.max_backlogs) } };
    const evaluatedCandidates = candidates.map((student) => ({ student, eligibility: evaluateStudentEligibility(student, effectiveDrive) }));
    const scoredCandidates = evaluatedCandidates.filter(({ student, eligibility }) => eligibility.status === 'ELIGIBLE' && (constraints.min_project_score === undefined || student.project_score >= constraints.min_project_score)).map(({ student }) => calculateWeightedScore(student, drive));
    const ordered = mergeSortCandidates(scoredCandidates);
    const selected = algorithm === 'HEAP_TOPK' ? heapTopK(scoredCandidates, topK ?? scoredCandidates.length) : ordered;
    const orderedCandidates = selected.map((candidate, index) => ({ student_id: candidate.student_id, score: candidate.score, rank: index + 1 }));
    const identity: { candidatePool?: string[]; constraints?: RankingConstraints } = {};
    if (candidatePool !== undefined) identity.candidatePool = candidateIds;
    if (constraintKeys.length) identity.constraints = Object.fromEntries(['min_cgpa', 'max_backlogs', 'min_project_score'].filter((key) => constraints[key as keyof RankingConstraints] !== undefined).map((key) => [key, constraints[key as keyof RankingConstraints]])) as RankingConstraints;
    const result = { ranking_id: createDeterministicRankingId(driveId ?? '', this.profileRegistry.graph_version, algorithm, algorithm === 'HEAP_TOPK' ? selected.length : undefined, identity), ordered_candidates: orderedCandidates, total_score: orderedCandidates.reduce((sum, candidate) => sum + candidate.score, 0), algorithm, optimization_metric: optimizationMetric as OptimizationMetric, graph_version: this.profileRegistry.graph_version, tie_break_rule: TIE_BREAK_RULE, explored_candidate_count: evaluatedCandidates.length };
    this.results.set(result.ranking_id, result);
    return result;
  }
}
