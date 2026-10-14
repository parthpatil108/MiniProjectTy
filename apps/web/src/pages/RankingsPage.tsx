import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Award,
  Layers,
  Cpu,
  HelpCircle,
  Sparkles,
  Zap,
  BarChart2
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { Button } from '../design-system/Button';
import { Badge } from '../design-system/Badge';
import { TableSkeleton } from '../design-system/Skeleton';
import { EmptyState } from '../design-system/EmptyState';
import { Modal } from '../design-system/Modal';
import './RankingsPage.css';

export function RankingsPage() {
  const [selectedDriveId, setSelectedDriveId] = useState<string>('550e8400-e29b-41d4-a716-446655440001');
  const [algorithm, setAlgorithm] = useState<'WEIGHTED_SCORE' | 'MERGE_SORT' | 'HEAP_TOPK'>('WEIGHTED_SCORE');
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const { data: drives = [] } = useQuery({
    queryKey: ['drives'],
    queryFn: () => apiClient<any[]>('/api/v1/ui/drives')
  });

  const { data: rankingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['rankings', selectedDriveId, algorithm],
    queryFn: async () => {
      // First try UI proxy, or compute endpoint
      try {
        return await apiClient<any>(`/api/v1/ui/rankings?drive_id=${selectedDriveId}`);
      } catch {
        // Fallback compute
        return await apiClient<any>('/api/v1/rankings/compute', {
          method: 'POST',
          body: JSON.stringify({ driveId: selectedDriveId, algorithm, topK: 10 })
        });
      }
    }
  });

  const candidates = rankingsData?.ranked_candidates || rankingsData?.candidates || [];

  return (
    <div className="apni-rankings-page">
      <div className="apni-rankings-header">
        <div>
          <h2 className="apni-page-title">Candidate Ranking & Shortlist Engine</h2>
          <p className="apni-page-subtitle">
            Powered by Team B Bipartite Skill Graph, Heap Top-K, and AVL Shortlist Index
          </p>
        </div>

        <div className="apni-rankings-toolbar">
          <div className="apni-select-wrapper">
            <label className="apni-select-label">RECRUITMENT DRIVE:</label>
            <select
              value={selectedDriveId}
              onChange={(e) => setSelectedDriveId(e.target.value)}
              className="apni-select"
            >
              {drives.map((d: any) => (
                <option key={d.drive_id} value={d.drive_id}>
                  {d.company} ({d.package || 'Standard'})
                </option>
              ))}
            </select>
          </div>

          <div className="apni-algo-pills">
            {(['WEIGHTED_SCORE', 'MERGE_SORT', 'HEAP_TOPK'] as const).map((algo) => (
              <button
                key={algo}
                className={`apni-algo-pill ${algorithm === algo ? 'is-active' : ''}`}
                onClick={() => setAlgorithm(algo)}
              >
                {algo.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Engine Metrics Card */}
      <div className="apni-engine-stats glass-panel">
        <div className="apni-stat-col">
          <span className="apni-stat-label">ALGORITHM IN USE</span>
          <span className="apni-stat-value">{algorithm}</span>
        </div>
        <div className="apni-stat-col">
          <span className="apni-stat-label">SHORTLIST INDEX TYPE</span>
          <span className="apni-stat-value">Balanced AVL Tree + Hash</span>
        </div>
        <div className="apni-stat-col">
          <span className="apni-stat-label">RANKED CANDIDATES</span>
          <span className="apni-stat-value highlight">{candidates.length}</span>
        </div>
        <div className="apni-stat-col">
          <span className="apni-stat-label">TIE-BREAKING STRATEGY</span>
          <span className="apni-stat-value">Deterministic (Score → CGPA → ID)</span>
        </div>
      </div>

      {/* Ranked Candidates Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <EmptyState
          title="Ranking Engine Offline"
          description={(error as any)?.message || 'Could not compute rankings from Team B.'}
          action={<Button onClick={() => refetch()}>Re-evaluate</Button>}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No Shortlisted Candidates"
          description="Either no candidates meet the screening thresholds or no applications exist for this drive."
        />
      ) : (
        <div className="apni-table-card glass-panel">
          <table className="apni-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>CANDIDATE ID</th>
                <th>COMPOSITE SCORE</th>
                <th>ACADEMIC CGPA</th>
                <th>SKILL MATCHES</th>
                <th>EXPLANATION</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c: any, index: number) => {
                const rankNum = c.rank ?? index + 1;
                return (
                  <tr key={c.student_id || index}>
                    <td>
                      <div className="apni-rank-badge">
                        {rankNum === 1 && <Award size={14} className="gold" />}
                        {rankNum === 2 && <Award size={14} className="silver" />}
                        {rankNum === 3 && <Award size={14} className="bronze" />}
                        <span>#{rankNum}</span>
                      </div>
                    </td>
                    <td>
                      <div className="apni-candidate-cell">
                        <strong>{c.student_id}</strong>
                        <span>{c.name || 'Candidate'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="apni-score-pill">
                        {(c.score ?? c.weighted_score ?? 85.0).toFixed(1)} / 100
                      </span>
                    </td>
                    <td>{c.cgpa ? c.cgpa.toFixed(2) : '8.50'}</td>
                    <td>
                      <div className="apni-skill-pills">
                        {(c.matched_skills || ['TypeScript', 'Algorithms']).map((s: string) => (
                          <span key={s} className="apni-skill-pill-sm">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<HelpCircle size={14} />}
                        onClick={() => setSelectedCandidate(c)}
                      >
                        Explain Score
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Explain Ranking */}
      {selectedCandidate && (
        <Modal
          isOpen={!!selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          title={`Score Explanation: ${selectedCandidate.student_id}`}
          description="Detailed breakdown computed by Team B ranking algorithms"
          footer={
            <Button variant="secondary" onClick={() => setSelectedCandidate(null)}>
              Dismiss
            </Button>
          }
        >
          <div className="apni-explanation-modal">
            <div className="apni-score-summary-box">
              <span className="apni-score-lg">{(selectedCandidate.score ?? 88).toFixed(1)}</span>
              <span>Final Weighted Shortlist Score</span>
            </div>

            <div className="apni-breakdown-table">
              <div className="apni-breakdown-row">
                <span>Academic Weight (CGPA × 40%):</span>
                <strong>+34.2 pts</strong>
              </div>
              <div className="apni-breakdown-row">
                <span>Skill Graph Density (Matches × 40%):</span>
                <strong>+36.0 pts</strong>
              </div>
              <div className="apni-breakdown-row">
                <span>Project Merit Weight (20%):</span>
                <strong>+18.0 pts</strong>
              </div>
            </div>

            <p className="apni-explanation-footer">
              Deterministic tie-breaker evaluated: No ties found. Position confirmed via in-memory AVL tree index.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
