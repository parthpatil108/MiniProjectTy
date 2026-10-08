import type { View } from '../App';

type InboxViewProps = { onNavigate: (view: View) => void };

export function InboxView({ onNavigate }: InboxViewProps) {
  const actionItems = [['TCS application closes tomorrow', 'Review the drive before the application deadline.', 'Drives'], ['Interview schedule requires confirmation', 'Review your Google interview workspace.', 'Interview']];
  const updates = ['TCS shortlist released', 'Infosys drive opened', 'Placement performance report published'];
  return <section className="section-page"><header className="topbar"><div><span className="eyebrow">PLACIFY inbox</span><h2>Inbox</h2><p className="page-context">Action items and placement updates that need your attention.</p></div><span className="status-pill">2 actions</span></header><div className="inbox-section"><div className="inbox-heading"><span>Action required</span><small>Needs your attention</small></div>{actionItems.map(([title, detail, view]) => <article className="inbox-item action" key={title}><span className="inbox-icon">!</span><div><strong>{title}</strong><p>{detail}</p></div><button className="secondary-button" type="button" onClick={() => onNavigate(view as View)}>Review</button></article>)}</div><div className="inbox-section"><div className="inbox-heading"><span>Updates</span><small>Recent placement activity</small></div>{updates.map((title) => <article className="inbox-item" key={title}><span className="inbox-icon info">i</span><div><strong>{title}</strong><p>Placement Cell · Today</p></div><button className="text-button" type="button" onClick={() => onNavigate('Updates')}>Open →</button></article>)}</div></section>;
}
