import { useState } from 'react';
import { useEffect } from 'react';
import type { Role } from '../App';
import { fetchPlacementReport, type PlacementSnapshot } from '../services/portalApi';

export function ReportsView({ role }: { role: Role }) {
  const [period, setPeriod] = useState('Current cycle');
  const [department, setDepartment] = useState('All departments');
  const [snapshot, setSnapshot] = useState<PlacementSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlacementReport().then(setSnapshot).catch(() => setError('Unable to load the latest placement report. Data may be outdated.')).catch(() => undefined);
  }, [role]);

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Reports</span>
          <h2>{role === 'Student' ? 'My placement progress' : 'Placement performance'}</h2>
        </div>
        <div className="filter-row">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Report period"><option>Current cycle</option><option>Last cycle</option></select>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Report department"><option>All departments</option><option>Engineering</option><option>Business</option></select>
          <button className="secondary-button" type="button" onClick={() => window.print()}>Export report</button>
          {role === 'Placement_Admin' && <button className="secondary-button" type="button">Publish update</button>}
        </div>
      </header>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="report-metrics">
        <div><small>Total applications</small><strong>{snapshot?.totalApplications ?? '—'}</strong></div>
        <div><small>Eligible students</small><strong>{snapshot?.eligibleStudents ?? '—'}</strong></div>
        <div><small>Shortlisted</small><strong>{snapshot?.shortlistedStudents ?? '—'}</strong></div>
        <div><small>Placed</small><strong>{snapshot?.placedStudents ?? '—'}</strong></div>
      </div>
      <div className="section-grid report-grid">
        <article className="section-card">
          <div className="section-card-header">
            <strong>Placement yield</strong>
          </div>
          <p>Overall success rate for {department.toLowerCase()} in the {period.toLowerCase()}.</p>
          <ul>
            <li>Placed: {snapshot?.placedStudents ?? '—'}</li>
            <li>Shortlisted: {snapshot?.shortlistedStudents ?? '—'}</li>
            <li>Conversion: {snapshot ? `${((snapshot.placedStudents / snapshot.shortlistedStudents) * 100).toFixed(1)}%` : '—'}</li>
          </ul>
        </article>
        <article className="section-card">
          <div className="section-card-header"><strong>Branch-wise placement</strong><span className="eyebrow">Team C data</span></div>
          <div className="bar-list">{snapshot?.branchBreakdown.map((item) => <div key={item.branch}><span><strong>{item.branch}</strong><small>{item.placed} placed / {item.applications} applications</small></span><i style={{ width: `${Math.max(12, item.placed / item.applications * 100)}%` }} /></div>)}</div>
        </article>
      </div>
    </section>
  );
}
