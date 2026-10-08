import type { Application } from '../App';

type ApplicationsViewProps = {
  applications: Application[];
};

export function ApplicationsView({ applications }: ApplicationsViewProps) {
  const statusClass = (status: string) => status.toLowerCase().replace(' ', '-');

  return (
    <section className="section-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Applications</span>
          <h2>Candidate pipeline</h2>
        </div>
      </header>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Candidate</th><th>Role</th><th>Status</th><th>Queue</th><th>Rank</th><th>Score</th></tr></thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td><strong>{app.name}</strong><small>{app.id} · {app.branch}</small></td>
                <td>{app.role}</td>
                <td><span className={`status-tag small-tag ${statusClass(app.status)}`}>{app.status}</span></td>
                <td>#{app.queuePosition}</td>
                <td>#{app.rank} · {app.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
