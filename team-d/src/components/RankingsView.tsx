import { useEffect, useState } from 'react';
import { fetchRankings } from '../services/portalApi';

export function RankingsView() {
  const [rankings, setRankings] = useState<Array<{ rank: number; name: string; score: string; status: string; isCurrentUser?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchRankings().then(setRankings).finally(() => setLoading(false)); }, []);
  return <section className="section-page"><header className="topbar"><div><span className="eyebrow">Team B results</span><h2>Ranking / shortlist</h2><p className="page-context">Ranking data is consumed from the ranking service.</p></div><span className="status-pill">{rankings.length} candidates</span></header><div className="table-wrap">{loading ? <div className="loading-inline">Loading ranking results...</div> : <table className="data-table"><thead><tr><th>Rank</th><th>Candidate</th><th>Score</th><th>Shortlist status</th></tr></thead><tbody>{rankings.map((candidate) => <tr className={candidate.isCurrentUser ? 'current-row' : ''} key={candidate.rank}><td><strong>#{candidate.rank}</strong></td><td>{candidate.name}{candidate.isCurrentUser && <small className="current-label">You</small>}</td><td>{candidate.score}</td><td><span className="status-tag small-tag">{candidate.status}</span></td></tr>)}</tbody></table>}</div></section>;
}
