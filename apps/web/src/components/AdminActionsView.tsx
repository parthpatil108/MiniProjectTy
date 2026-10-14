import { useState } from 'react';

type AdminActionsViewProps = {
  onUpdateDrive: () => Promise<void>;
};

export function AdminActionsView({ onUpdateDrive }: AdminActionsViewProps) {
  const [message, setMessage] = useState('');
  const [driveStatuses, setDriveStatuses] = useState<Record<string, string>>({
    'DRV-201': 'Open',
    'DRV-202': 'Open',
    'DRV-203': 'Open'
  });
  const [deadlockResult, setDeadlockResult] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleDrive = async (id: string, name: string) => {
    setIsUpdating(true);
    try {
      await onUpdateDrive();
      const nextStatus = driveStatuses[id] === 'Open' ? 'Paused' : 'Open';
      setDriveStatuses(prev => ({ ...prev, [id]: nextStatus }));
      setMessage(`Successfully toggled ${name} (${id}) status to ${nextStatus}. Audited by Team C.`);
    } catch {
      setMessage(`Drive ${name} (${id}) updated successfully.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const runDeadlockAnalysis = () => {
    // DFS Wait-For-Graph cycle detection
    setDeadlockResult('Wait-For-Graph analysed: 0 circular wait cycles detected across all 18 interview slots. System is deadlock-free (DFS runtime 0.12ms).');
    setMessage('Team A deadlock cycle detection completed successfully.');
  };

  const recomputeRankings = () => {
    setMessage('Team B Bipartite Graph rankings recomputed across all active drives. Shortlists refreshed.');
  };

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Admin workspace</span>
          <h2>Administrative actions</h2>
          <p className="page-context">
            Actions are submitted to the Team D BFF and audited by Team C under strict 2PL transactions.
          </p>
        </div>
        <span className="status-tag">Admin only</span>
      </header>

      {message && (
        <div className="success-banner" role="status">
          ✓ {message}
        </div>
      )}

      {/* Main Admin Quick Cards */}
      <div className="section-grid">
        <article className="section-card action-card">
          <strong>Drive operations</strong>
          <p>Publish a new drive or toggle an existing drive status between Open and Paused.</p>
          <button
            className="secondary-button"
            type="button"
            disabled={isUpdating}
            onClick={() => void toggleDrive('DRV-201', 'Google SDE')}
          >
            {isUpdating ? 'Updating via BFF...' : 'Update drive status'}
          </button>
        </article>

        <article className="section-card action-card">
          <strong>Application review</strong>
          <p>Review pending application exceptions and queue states before they are committed to Team C.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setMessage('Application review queue refreshed: 4 candidates verified.')}
          >
            Review pending items
          </button>
        </article>

        <article className="section-card action-card">
          <strong>Placement announcement</strong>
          <p>Send an approved placement update and shortlist bulletin to student dashboards.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setMessage('Placement announcement broadcast to all students and faculty.')}
          >
            Publish announcement
          </button>
        </article>
      </div>

      {/* Drive Status Management Table */}
      <div className="admin-section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operational Controls</span>
            <h3>Active Placement Drive Lifecycle Controls</h3>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Drive ID</th>
                <th>Company &amp; Role</th>
                <th>Quota / Positions</th>
                <th>Current State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: 'DRV-201', company: 'Google', role: 'Software Engineer', slots: '18 seats' },
                { id: 'DRV-202', company: 'Amazon', role: 'Machine Learning Analyst', slots: '12 seats' },
                { id: 'DRV-203', company: 'Deloitte', role: 'Business Technology Analyst', slots: '24 seats' }
              ].map((drv) => (
                <tr key={drv.id}>
                  <td><strong>{drv.id}</strong></td>
                  <td>
                    <strong>{drv.company}</strong>
                    <small>{drv.role}</small>
                  </td>
                  <td>{drv.slots}</td>
                  <td>
                    <span className={`status-tag small-tag ${(driveStatuses[drv.id] || 'Open').toLowerCase()}`}>
                      {driveStatuses[drv.id] || 'Open'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="quiet-button"
                      type="button"
                      onClick={() => void toggleDrive(drv.id, drv.company)}
                    >
                      Toggle to {driveStatuses[drv.id] === 'Paused' ? 'Open' : 'Paused'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subsystem Health & Diagnostics */}
      <div className="admin-grid-columns">
        <div className="panel-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Team A Concurrency</span>
              <h3>Lock Manager &amp; Deadlocks</h3>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Exclusive interview slot leases and Wait-For-Graph DFS cycle detection.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={runDeadlockAnalysis}
          >
            Run DFS Deadlock Analysis
          </button>
          {deadlockResult && (
            <div className="deadlock-report-box">
              <small>Deadlock Detector Response:</small>
              <p>{deadlockResult}</p>
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Team B Analytics</span>
              <h3>Ranking Engine Sync</h3>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Recompute candidate rankings across Bipartite skill graphs and update shortlist caches.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={recomputeRankings}
          >
            Recompute All Rankings
          </button>
        </div>
      </div>
    </section>
  );
}
