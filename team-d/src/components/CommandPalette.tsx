import { useEffect, useState } from 'react';
import type { Role, View } from '../App';

type CommandPaletteProps = { role: Role; onNavigate: (view: View) => void };

export function CommandPalette({ role, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const commands: Array<[string, View]> = role === 'Student' ? [['Find placement drive', 'Drives'], ['Saved drives', 'SavedDrives'], ['My applications', 'Applications'], ['My ranking', 'Rankings'], ['My journey', 'Journey'], ['Notifications', 'Inbox'], ['Profile', 'Profile']] : [['Live placement', 'Dashboard'], ['Applications', 'Applications'], ['Analytics', 'Analytics'], ['Reports', 'Reports'], ['Activity', 'Activity']];
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); } if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  return <>{<button className="command-hint" type="button" onClick={() => setOpen(true)}>⌘K</button>}{open && <div className="command-backdrop" role="presentation" onClick={() => setOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="PLACIFY command palette" onClick={(event) => event.stopPropagation()}><div className="command-search">⌕ <input autoFocus placeholder="Search PLACIFY commands..." aria-label="Search commands" /></div><div className="command-list">{commands.map(([label, view]) => <button key={label} type="button" onClick={() => { setOpen(false); onNavigate(view); }}>{label}<span>→</span></button>)}</div><small>Press Esc to close · Ctrl/Cmd + K to open</small></section></div>}</>;
}
