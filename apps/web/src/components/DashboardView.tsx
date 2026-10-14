import type { Application } from '../App';
import type { LiveConnectionState } from '../services/portalApi';
import type { Role, View } from '../App';

type DashboardViewProps = {
  stats: Array<{ label: string; value: string; tone: string }>;
  applications: Application[];
  liveEvents: Array<{ id: number; text: string; time: string }>;
  selectedAppId: string;
  selectedApplication: Application;
  onSelectApplication: (id: string) => void;
  liveState: LiveConnectionState;
  role: Role;
  onNavigate: (view: View) => void;
  onOpenNotifications?: () => void;
};

export function DashboardView({
  stats,
  applications,
  liveEvents,
  selectedAppId,
  selectedApplication,
  onSelectApplication,
  liveState,
  role,
  onNavigate,
  onOpenNotifications
}: DashboardViewProps) {
  const isStudent = role === 'Student';

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">
            {isStudent ? 'Student workspace' : role === 'Faculty_TPO' ? 'Placement operations' : 'Management console'}
          </span>
          <h2>
            {isStudent
              ? 'Good morning, Priya'
              : role === 'Faculty_TPO'
              ? 'Placement Operations Center'
              : 'Placement Management Console'}
          </h2>
          <p className="page-context">Academic Year 2026–27 · Integrated Microservices Architecture</p>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${liveState !== 'connected' ? 'status-warning' : ''}`}>
            <i className="dot" /> {liveState === 'connected' ? 'Live data (SSE)' : 'Reconnecting...'}
          </span>
          <button
            className="quiet-button"
            type="button"
            onClick={onOpenNotifications}
            title="Open Live Notification Stream"
          >
            Live Activity ({liveEvents.length})
          </button>
        </div>
      </header>

      {isStudent ? (
        <>
          <section className="welcome-strip">
            <div>
              <span className="eyebrow">Your placement journey</span>
              <h3>72% complete</h3>
              <p>Keep your profile current to make the most of this placement cycle.</p>
            </div>
            <button
              className="primary-button compact-button"
              type="button"
              onClick={() => onNavigate('Profile')}
            >
              Complete profile <span>→</span>
            </button>
          </section>

          <section className="journey-panel panel-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Placement journey</span>
                <h3>Discover · Check · Apply · Track</h3>
              </div>
              <span className="journey-progress">3 of 7 steps</span>
            </div>
            <div className="journey-line">
              {['Profile', 'Eligibility', 'Applications', 'Shortlisting', 'Interview', 'Selection', 'Offer'].map(
                (step, index) => (
                  <div
                    className={`journey-step ${index < 3 ? 'done' : index === 3 ? 'current' : ''}`}
                    key={step}
                  >
                    <span>{index < 3 ? '✓' : index === 3 ? '•' : ''}</span>
                    <small>{step}</small>
                  </div>
                )
              )}
            </div>
          </section>

          <div className="dashboard-columns">
            <section className="panel-card readiness-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Placement readiness</span>
                  <h3>Ready for your next opportunity</h3>
                </div>
                <strong className="readiness-score">82%</strong>
              </div>
              <div className="readiness-bar">
                <i style={{ width: '82%' }} />
              </div>
              <ul className="readiness-list">
                <li>
                  <span>Academic</span>
                  <strong>90%</strong>
                </li>
                <li>
                  <span>Skills</span>
                  <strong>80%</strong>
                </li>
                <li>
                  <span>Profile</span>
                  <strong>100%</strong>
                </li>
                <li>
                  <span>Applications</span>
                  <strong>70%</strong>
                </li>
              </ul>
              <div className="next-step">
                <small>Recommended next step</small>
                <strong>Complete your project details to improve profile completeness.</strong>
                <button className="text-button" type="button" onClick={() => onNavigate('Profile')}>
                  Complete profile →
                </button>
              </div>
            </section>

            <section className="panel-card quick-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Shortcuts</span>
                  <h3>Quick actions</h3>
                </div>
              </div>
              <div className="quick-actions">
                <button type="button" onClick={() => onNavigate('Drives')}>
                  Find placement drives <span>↗</span>
                </button>
                <button type="button" onClick={() => onNavigate('Applications')}>
                  My applications <span>↗</span>
                </button>
                <button type="button" onClick={() => onNavigate('Rankings')}>
                  View my ranking <span>↗</span>
                </button>
                <button type="button" onClick={onOpenNotifications ?? (() => onNavigate('Drives'))}>
                  Live notification feed <span>↗</span>
                </button>
              </div>
            </section>
          </div>

          <div className="dashboard-columns lower-columns">
            <section className="panel-card recommended-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Recommended for you</span>
                  <h3>Opportunities worth a look</h3>
                </div>
                <button className="text-button" type="button" onClick={() => onNavigate('Drives')}>
                  View all →
                </button>
              </div>
              <div className="recommended-list">
                <button type="button" onClick={() => onNavigate('Drives')}>
                  <span className="company-mark">G</span>
                  <span>
                    <strong>Google · Software Engineer</strong>
                    <small>₹24 LPA · CSE / IT</small>
                  </span>
                  <b>96% match</b>
                </button>
                <button type="button" onClick={() => onNavigate('Drives')}>
                  <span className="company-mark amazon-mark">A</span>
                  <span>
                    <strong>Amazon · ML Analyst</strong>
                    <small>₹18 LPA · CSE / ECE</small>
                  </span>
                  <b>88% match</b>
                </button>
              </div>
            </section>

            <section className="panel-card whats-new-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">What's new</span>
                  <h3>Recent updates</h3>
                </div>
                <button className="text-button" type="button" onClick={onOpenNotifications ?? (() => {})}>
                  Live feed ({liveEvents.length}) →
                </button>
              </div>
              <ul className="news-list">
                {liveEvents.slice(0, 3).map((evt) => (
                  <li key={evt.id}>
                    <i />
                    <span>
                      <strong>{evt.text}</strong>
                      <small>{evt.time}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : (
        <section className="operations-intro panel-card">
          <div>
            <span className="eyebrow">Live operations</span>
            <h3>
              {role === 'Faculty_TPO'
                ? 'Monitor the placement cycle in one place.'
                : 'Manage every placement operation with confidence.'}
            </h3>
            <p>
              {role === 'Faculty_TPO'
                ? 'Review drive health, student applications, shortlist movement, and placement outcomes.'
                : 'Review drive status, application volume, placement analytics, and operational actions.'}
            </p>
          </div>
          <button
            className="primary-button compact-button"
            type="button"
            onClick={() => onNavigate(role === 'Faculty_TPO' ? 'Reports' : 'AdminActions')}
          >
            {role === 'Faculty_TPO' ? 'Open analytics' : 'Manage drives'} <span>→</span>
          </button>
        </section>
      )}

      <div className="stats-grid">
        {stats.map((item) => (
          <article key={item.label} className={`stat-card ${item.tone}`}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="panel-grid applications-grid">
        <section className="panel-card list-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Submissions</span>
              <h3>Recent applications</h3>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate('Applications')}>
              View all ({applications.length}) →
            </button>
          </div>

          <ul className="application-list">
            {applications.map((app) => (
              <li
                key={app.id}
                className={selectedAppId === app.id ? 'selected' : ''}
                onClick={() => onSelectApplication(app.id)}
              >
                <div>
                  <strong>{app.name}</strong>
                  <span>{app.role}</span>
                </div>
                <div className="application-meta">
                  <small>{app.status}</small>
                  <small>{app.id}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card detail-panel">
          <div className="detail-header">
            <div>
              <span className="eyebrow">Application</span>
              <h3>{selectedApplication.name}</h3>
            </div>
            <span className="status-tag">{selectedApplication.status}</span>
          </div>

          <div className="detail-grid">
            <div>
              <label>Application ID</label>
              <strong>{selectedApplication.id}</strong>
            </div>
            <div>
              <label>Role</label>
              <strong>{selectedApplication.role}</strong>
            </div>
            <div>
              <label>CGPA</label>
              <strong>{selectedApplication.cgpa}</strong>
            </div>
            <div>
              <label>Branch</label>
              <strong>{selectedApplication.branch}</strong>
            </div>
            <div>
              <label>Eligibility Score</label>
              <strong style={{ color: '#277b88' }}>{selectedApplication.score}</strong>
            </div>
            <div>
              <label>Queue position</label>
              <strong>#{selectedApplication.queuePosition}</strong>
            </div>
            <div>
              <label>Shortlist rank</label>
              <strong>#{selectedApplication.rank}</strong>
            </div>
            <div>
              <label>Target Drive</label>
              <strong>Google SDE</strong>
            </div>
          </div>
          <p className="detail-update">
            <strong>Latest update:</strong> {selectedApplication.update}
          </p>
          <div className="application-timeline">
            <span className="eyebrow">Application timeline</span>
            <div className="timeline-row">
              <i className="timeline-done" />
              <span>
                <strong>Applied</strong>
                <small>Submitted to Team C</small>
              </span>
            </div>
            <div className="timeline-row">
              <i className="timeline-done" />
              <span>
                <strong>Screening</strong>
                <small>Team A rules verified</small>
              </span>
            </div>
            <div className="timeline-row">
              <i className="timeline-current" />
              <span>
                <strong>Shortlisting</strong>
                <small>Team B ranking computed</small>
              </span>
            </div>
            <div className="timeline-row">
              <i />
              <span>
                <strong>Interview Slot</strong>
                <small>Team A slot lock lease</small>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel-card live-panel">
        <div className="live-header">
          <div>
            <span className="eyebrow">Team C Outbox Stream</span>
            <h3>Live transactional event feed</h3>
          </div>
          <span className="live-indicator">
            <i className="dot" /> Streaming (SSE)
          </span>
        </div>

        <ul className="live-list">
          {liveEvents.map((event) => (
            <li key={event.id}>
              <span>{event.text}</span>
              <small>{event.time}</small>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
