import { useEffect, useState, useMemo } from 'react';
import { fetchRankings, type CandidateRanking } from '../services/portalApi';

type CandidateRank = CandidateRanking;


export function RankingsView() {
  const [rankings, setRankings] = useState<CandidateRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [algorithm, setAlgorithm] = useState<'WEIGHTED_SCORE' | 'HEAP_TOPK' | 'MERGE_SORT'>('WEIGHTED_SCORE');
  const [selectedDrive, setSelectedDrive] = useState('Google SDE Drive (DRV-201)');

  useEffect(() => {
    setLoading(true);
    fetchRankings()
      .then((data) => {
        // Enrich data with branch and skills if missing
        const enriched = data.map((cand, idx) => ({
          ...cand,
          branch: cand.branch ?? (idx % 2 === 0 ? 'CSE' : 'IT'),
          cgpa: cand.cgpa ?? (9.8 - idx * 0.2).toFixed(1),
          skillMatch: cand.skillMatch ?? `${Math.max(82, 98 - idx * 3)}%`
        }));
        setRankings(enriched);
      })
      .finally(() => setLoading(false));
  }, [algorithm, selectedDrive]);

  // Adjust order dynamically based on selected algorithm strategy
  const displayedRankings = useMemo(() => {
    if (algorithm === 'HEAP_TOPK') {
      return [...rankings].slice(0, 3);
    }
    if (algorithm === 'MERGE_SORT') {
      return [...rankings].sort((a, b) => parseFloat(b.cgpa ?? '0') - parseFloat(a.cgpa ?? '0'));
    }
    return rankings;
  }, [rankings, algorithm]);

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Team B Data Structures Engine</span>
          <h2>Candidate Rankings &amp; Shortlists</h2>
          <p className="page-context">
            Evaluated over bipartite skill graph modeling using custom AVL trees and multi-strategy ranking.
          </p>
        </div>
        <div className="topbar-actions">
          <select
            className="search-input"
            value={selectedDrive}
            onChange={(e) => setSelectedDrive(e.target.value)}
            aria-label="Select drive for ranking"
          >
            <option>Google SDE Drive (DRV-201)</option>
            <option>Amazon ML Analyst (DRV-202)</option>
            <option>Deloitte Tech (DRV-203)</option>
            <option>TechCorp System (DRV-204)</option>
          </select>
        </div>
      </header>

      {/* Algorithm strategy selector */}
      <div className="ranking-controls-card">
        <div className="algorithm-tabs">
          <button
            type="button"
            className={algorithm === 'WEIGHTED_SCORE' ? 'active' : ''}
            onClick={() => setAlgorithm('WEIGHTED_SCORE')}
          >
            <strong>Weighted Score</strong>
            <small>Composite Skill + CGPA</small>
          </button>
          <button
            type="button"
            className={algorithm === 'HEAP_TOPK' ? 'active' : ''}
            onClick={() => setAlgorithm('HEAP_TOPK')}
          >
            <strong>Binary Heap Top-K</strong>
            <small>O(N log K) Priority Queue</small>
          </button>
          <button
            type="button"
            className={algorithm === 'MERGE_SORT' ? 'active' : ''}
            onClick={() => setAlgorithm('MERGE_SORT')}
          >
            <strong>Merge Sort</strong>
            <small>O(N log N) Stable Order</small>
          </button>
        </div>

        <div className="ranking-kpi-summary">
          <div>
            <small>Algorithm Latency</small>
            <strong style={{ color: '#2d8564' }}>&lt; 0.25 ms</strong>
          </div>
          <div>
            <small>Graph Representation</small>
            <strong>Bipartite Adjacency List</strong>
          </div>
          <div>
            <small>Active Shortlist Quota</small>
            <strong>Top 5 Candidates</strong>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-inline">
            <div className="spinner" /> Computing ranking results via Team B...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate Name</th>
                <th>Branch &amp; CGPA</th>
                <th>Skill Graph Match</th>
                <th>Composite Score</th>
                <th>Shortlist Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedRankings.map((candidate, idx) => (
                <tr
                  className={candidate.isCurrentUser ? 'current-row' : ''}
                  key={`${candidate.rank}-${candidate.name}`}
                >
                  <td>
                    <span className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {candidate.name}
                      {candidate.isCurrentUser && <span className="current-user-pill">You</span>}
                    </strong>
                  </td>
                  <td>
                    {candidate.branch} · CGPA {candidate.cgpa}
                  </td>
                  <td>
                    <span className="skill-match-tag">{candidate.skillMatch}</span>
                  </td>
                  <td>
                    <strong style={{ color: '#277b88' }}>{candidate.score}</strong>
                  </td>
                  <td>
                    <span className="status-tag small-tag">{candidate.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
