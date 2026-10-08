export interface Student {
  student_id: string;
  name: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  attendance: number;
  project_score: number;
  skill_tags: string[];
}

export interface DriveCriteria {
  min_cgpa: number;
  max_backlogs: number;
  allowed_branches: string[];
  min_attendance: number;
  required_skill_tags: string[];
}

export interface Drive {
  drive_id: string;
  company: string;
  criteria: DriveCriteria;
  skill_weightage: Record<string, number>;
  seats: number;
  package: string;
  state: string;
  version: number;
}

export type GraphNode = string;
export type GraphEdge = readonly [GraphNode, GraphNode];
export type GraphObject = Record<GraphNode, GraphNode[]>;

export interface GraphSummary {
  graph_version: string;
  total_students: number;
  total_drives: number;
  representation_type: 'ADJACENCY_LIST';
}

export interface EligibilityResult {
  student_id: string;
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  reasons: string[];
}

export interface ScoreBreakdown {
  skill_score: number;
  cgpa_score: number;
  project_score: number;
}

export interface CandidateScore {
  student_id: string;
  score: number;
  cgpa: number;
  score_breakdown: ScoreBreakdown;
}

export interface ComparableCandidate {
  student_id: string;
  score: number;
  cgpa: number;
}

export interface RankedCandidate {
  student_id: string;
  score: number;
  rank: number;
}

export interface ShortlistEntry extends RankedCandidate {}

export type PlacementStage = 'Applied' | 'Eligible' | 'Shortlisted' | 'Placed';

export interface HistoricalPlacementRecord {
  student_id: string;
  department: string;
  batch: string;
  company: string;
  stage: PlacementStage;
  package_lpa?: number;
}

export type RankingAlgorithm = 'WEIGHTED_SCORE' | 'MERGE_SORT' | 'HEAP_TOPK';

export interface RankingResult {
  ranking_id: string;
  ordered_candidates: RankedCandidate[];
  total_score: number;
  algorithm: RankingAlgorithm;
  graph_version: string;
  tie_break_rule: string;
  explored_candidate_count: number;
}

export type TopKResult = RankedCandidate[];

export interface ComputeRankingOptions {
  driveId?: string;
  algorithm?: RankingAlgorithm;
  topK?: number;
}
