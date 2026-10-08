import type { Role, View } from '../App';

type CalendarViewProps = { role: Role; onNavigate: (view: View) => void };

export function CalendarView({ role, onNavigate }: CalendarViewProps) {
  const events = role === 'Student' ? [
    ['18 Aug', 'Google application deadline', 'Drive deadline'],
    ['29 Aug', 'Google SDE interview', 'Interview · Confirmed'],
    ['02 Sep', 'Amazon assessment window', 'Online assessment']
  ] : [
    ['Today', 'TCS shortlist review', 'Operations · 14:32'],
    ['29 Aug', 'Google interview panel', 'Interview scheduling'],
    ['02 Sep', 'Placement review meeting', 'TPO / Admin review']
  ];
  return <section className="section-page"><header className="topbar"><div><span className="eyebrow">Schedule</span><h2>Placement calendar</h2><p className="page-context">Important deadlines and placement events in one view.</p></div></header><div className="calendar-layout"><div className="calendar-month"><div className="calendar-heading"><strong>August 2026</strong><span>‹　›</span></div><div className="calendar-week">{['M','T','W','T','F','S','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: 31 }, (_, index) => <span className={index + 1 === 18 || index + 1 === 29 ? 'event-day' : index + 1 === 27 ? 'today-day' : ''} key={index}>{index + 1}</span>)}</div></div><div className="event-list"><div className="section-heading"><div><span className="eyebrow">Upcoming</span><h3>{role === 'Student' ? 'Your schedule' : 'Operations schedule'}</h3></div></div>{events.map(([date, title, detail]) => <button className="event-row" type="button" key={title} onClick={() => onNavigate(title.includes('interview') ? 'Interview' : 'Drives')}><strong>{date}</strong><span><b>{title}</b><small>{detail}</small></span><span>→</span></button>)}</div></div></section>;
}
