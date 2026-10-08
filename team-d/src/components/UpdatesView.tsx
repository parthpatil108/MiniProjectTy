import { useEffect, useState } from 'react';
import { fetchPlacementUpdates } from '../services/portalApi';

export function UpdatesView() {
  const [updates, setUpdates] = useState<Array<{ id: number; title: string; detail: string; time: string; type: string }>>([]);
  useEffect(() => { fetchPlacementUpdates().then(setUpdates); }, []);
  return <section className="section-page"><header className="topbar"><div><span className="eyebrow">Notifications</span><h2>Placement updates</h2></div><span className="live-indicator"><i className="dot" /> Live</span></header><div className="updates-list">{updates.map((update) => <article className={`update-item ${update.type}`} key={update.id}><span className="update-icon">{update.type === 'success' ? '✓' : update.type === 'warning' ? '!' : 'i'}</span><div><strong>{update.title}</strong><p>{update.detail}</p></div><small>{update.time}</small></article>)}</div></section>;
}
