import { useState, useMemo } from 'react';
import type { Application } from '../App';

type ApplicationsViewProps = {
  applications: Application[];
};

export function ApplicationsView({ applications }: ApplicationsViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-');

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch = `${app.name} ${app.role} ${app.id} ${app.branch}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'SHORTLISTED') return app.status.toLowerCase().includes('shortlist');
      if (statusFilter === 'INTERVIEW') return app.status.toLowerCase().includes('interview');
      if (statusFilter === 'APPLIED') return app.status.toLowerCase().includes('applied') || app.status.toLowerCase().includes('eligible');
      return true;
    });
  }, [applications, query, statusFilter]);

  const stages = [
    { key: 'APPLIED', label: 'Applied' },
    { key: 'SCREENING', label: 'Screening' },
    { key: 'RULE_EVALUATED', label: 'Rule Evaluated' },
    { key: 'SHORTLISTED', label: 'Shortlisted' },
    { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
    { key: 'SELECTED', label: 'Selected' },
    { key: 'OFFER_ISSUED', label: 'Offer Issued' }
  ];

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Recruitment Funnel</span>
          <h2>Candidate pipeline</h2>
          <p className="page-context">
            Lifecycle state machine managed by Team C custom DBMS under strict 2PL serializability.
          </p>
        </div>
        <div className="topbar-actions">
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidate, role or ID..."
            aria-label="Search applications"
          />
        </div>
      </header>

      {/* Quick Status Stats */}
      <div className="pipeline-stats-row">
        <div className="pipeline-stat-pill" onClick={() => setStatusFilter('ALL')}>
          <small>Total In Pipeline</small>
          <strong>{applications.length}</strong>
        </div>
        <div className="pipeline-stat-pill" onClick={() => setStatusFilter('APPLIED')}>
          <small>Applied / Screening</small>
          <strong>{applications.filter(a => a.status === 'Applied' || a.status === 'Eligible').length}</strong>
        </div>
        <div className="pipeline-stat-pill" onClick={() => setStatusFilter('SHORTLISTED')}>
          <small>Shortlisted (Team B)</small>
          <strong>{applications.filter(a => a.status.toLowerCase().includes('shortlist')).length}</strong>
        </div>
        <div className="pipeline-stat-pill" onClick={() => setStatusFilter('INTERVIEW')}>
          <small>In Interview (Team A Slot)</small>
          <strong>{applications.filter(a => a.status.toLowerCase().includes('interview')).length}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Target Role</th>
              <th>State Machine Status</th>
              <th>Scheduling Queue</th>
              <th>Merit Rank</th>
              <th>Eligibility Score</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No candidate applications found matching the current search.
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  style={{ cursor: 'pointer' }}
                  className={selectedApp?.id === app.id ? 'current-row' : ''}
                >
                  <td>
                    <strong>{app.name}</strong>
                    <small>{app.id} · {app.branch} · CGPA {app.cgpa}</small>
                  </td>
                  <td>{app.role}</td>
                  <td>
                    <span className={`status-tag small-tag ${statusClass(app.status)}`}>
                      {app.status}
                    </span>
                  </td>
                  <td>
                    <strong>#{app.queuePosition}</strong>
                    <small>FIFO Queue</small>
                  </td>
                  <td>
                    <strong>#{app.rank}</strong>
                    <small>Top-K Heap</small>
                  </td>
                  <td>
                    <strong style={{ color: '#277b88' }}>{app.score}</strong>
                  </td>
                  <td>
                    <button
                      className="quiet-button"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApp(app);
                      }}
                    >
                      View Trail →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Application Lifecycle Detail Drawer / Modal */}
      {selectedApp && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedApp(null)}>
          <section
            className="drive-modal application-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedApp(null)}
              aria-label="Close details"
            >
              ×
            </button>

            <span className="eyebrow">Application Record · {selectedApp.id}</span>
            <h3 id="app-detail-title">
              {selectedApp.name} — {selectedApp.role}
            </h3>

            <div className="drive-detail-grid">
              <div>
                <small>Branch / Department</small>
                <strong>{selectedApp.branch} (Final Year)</strong>
              </div>
              <div>
                <small>Current CGPA</small>
                <strong>{selectedApp.cgpa}</strong>
              </div>
              <div>
                <small>Team A Eligibility</small>
                <strong style={{ color: '#2d8564' }}>{selectedApp.score} (Eligible)</strong>
              </div>
              <div>
                <small>Team A Queue Position</small>
                <strong>#{selectedApp.queuePosition} in Priority Queue</strong>
              </div>
              <div>
                <small>Team B Ranking</small>
                <strong>Rank #{selectedApp.rank}</strong>
              </div>
              <div>
                <small>DBMS State</small>
                <strong className={`status-tag small-tag ${statusClass(selectedApp.status)}`}>
                  {selectedApp.status}
                </strong>
              </div>
            </div>

            <div className="application-timeline-panel">
              <strong>State Machine Transitions (Team C Strict 2PL):</strong>
              <div className="lifecycle-stepper">
                {stages.map((st, idx) => {
                  const isDone = idx <= 3;
                  const isCurrent = idx === 3;
                  return (
                    <div
                      key={st.key}
                      className={`lifecycle-step ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-active' : ''}`}
                    >
                      <span className="step-circle">{isDone ? '✓' : idx + 1}</span>
                      <small>{st.label}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="audit-note">
              <strong>Latest Subsystem Event:</strong>
              <p>{selectedApp.update}</p>
              <small>Trace ID: {selectedApp.id.replace('APP-', 'trace-corr-')}-002 · RPO=0s</small>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
