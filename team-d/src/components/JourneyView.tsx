import type { View } from '../App';

type JourneyViewProps = { onNavigate: (view: View) => void };

export function JourneyView({ onNavigate }: JourneyViewProps) {
  const milestones = [
    ['Profile completed', 'Your academic and personal details are ready.', true],
    ['First application', '4 applications submitted this cycle.', true],
    ['First shortlist', '2 applications have moved to shortlist.', true],
    ['First interview', 'Google interview is being prepared.', false],
    ['First selection', 'Selection outcome will appear here.', false],
    ['Offer received', 'Your offers will be tracked here.', false]
  ];
  return <section className="section-page"><header className="topbar"><div><span className="eyebrow">My journey</span><h2>Career journey</h2><p className="page-context">A clear view of your progress through this placement cycle.</p></div><span className="status-pill">72% complete</span></header><div className="journey-hero"><div><span className="eyebrow">Placement progress</span><h3>Discover opportunities. Build momentum.</h3><p>Your next meaningful step is preparing for the interview stage.</p></div><button className="primary-button compact-button" type="button" onClick={() => onNavigate('Drives')}>Explore drives <span>→</span></button></div><div className="milestone-list">{milestones.map(([title, detail, done], index) => <article className={`milestone-item ${done ? 'done' : 'upcoming'}`} key={title as string}><span>{done ? '✓' : index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div><small>{done ? 'Complete' : 'Upcoming'}</small></article>)}</div></section>;
}
