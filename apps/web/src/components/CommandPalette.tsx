import { useEffect, useState, useMemo } from 'react';
import type { Role, View } from '../App';

type CommandPaletteProps = {
  role: Role;
  onNavigate: (view: View) => void;
};

export function CommandPalette({ role, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const commands: Array<{ label: string; view: View; description: string; icon: string }> = useMemo(() => {
    if (role === 'Student') {
      return [
        { label: 'Explore Placement Drives', view: 'Drives', description: 'Browse active campus drives & check eligibility', icon: '▣' },
        { label: 'My Applications', view: 'Applications', description: 'Track application status & interview stages', icon: '▤' },
        { label: 'Rankings & Merit Board', view: 'Rankings', description: 'View Team B candidate rankings and scores', icon: '◒' },
        { label: 'Dashboard Overview', view: 'Dashboard', description: 'View placement progress and live updates', icon: '⌂' },
        { label: 'My Student Profile', view: 'Profile', description: 'Update skills, resume, and academic details', icon: '○' }
      ];
    }
    if (role === 'Faculty_TPO') {
      return [
        { label: 'Operations Dashboard', view: 'Dashboard', description: 'TPO overview and live placement statistics', icon: '⌂' },
        { label: 'Placement Drives Catalog', view: 'Drives', description: 'Inspect all campus recruitment drives', icon: '▣' },
        { label: 'Candidate Pipeline', view: 'Applications', description: 'Review student applications across departments', icon: '▤' },
        { label: 'Merit Rankings', view: 'Rankings', description: 'Team B candidate scoring and shortlists', icon: '◒' },
        { label: 'Placement Analytics', view: 'Analytics', description: 'Conversion funnels, trends and recruiter metrics', icon: '📈' },
        { label: 'Performance Reports', view: 'Reports', description: 'Branch-wise placement yields and summary report', icon: '📄' }
      ];
    }
    return [
      { label: 'Management Console', view: 'Dashboard', description: 'System health, KPIs and live outbox monitor', icon: '⌂' },
      { label: 'Drive Management', view: 'AdminActions', description: 'Pause/Open drives, manage quotas and lock audits', icon: '⚙' },
      { label: 'Placement Drives', view: 'Drives', description: 'Browse and inspect all recruitment drives', icon: '▣' },
      { label: 'Candidate Pipeline', view: 'Applications', description: 'All student applications & state transitions', icon: '▤' },
      { label: 'Ranking Computation', view: 'Rankings', description: 'Team B algorithm selection & candidate order', icon: '◒' },
      { label: 'Placement Analytics', view: 'Analytics', description: 'Comprehensive charts and intelligence', icon: '📈' },
      { label: 'Performance Reports', view: 'Reports', description: 'Download official placement reports', icon: '📄' }
    ];
  }, [role]);

  const filtered = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [commands, search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button className="command-hint" type="button" onClick={() => setOpen(true)} title="Quick Command Palette (Ctrl+K)">
        ⌘K
      </button>

      {open && (
        <div className="command-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="PLACIFY command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="command-search">
              <span>⌕</span>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PLACIFY actions, drives, views..."
                aria-label="Search commands"
              />
            </div>
            <div className="command-list">
              {filtered.length === 0 ? (
                <div className="command-empty">No matching actions found</div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setSearch('');
                      onNavigate(item.view);
                    }}
                  >
                    <span className="command-item-left">
                      <span className="command-icon">{item.icon}</span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </span>
                    <span>→</span>
                  </button>
                ))
              )}
            </div>
            <small>Press Esc to close · Ctrl/Cmd + K to toggle</small>
          </section>
        </div>
      )}
    </>
  );
}
