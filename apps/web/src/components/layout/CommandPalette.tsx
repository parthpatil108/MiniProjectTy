import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, FileCheck, TrendingUp, BarChart3, User, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { title: 'Dashboard', desc: 'Overview of placement metrics', icon: <BarChart3 size={16} />, path: '/' },
    { title: 'Placement Drives', desc: 'Explore open placement opportunities', icon: <Briefcase size={16} />, path: '/drives' },
    { title: 'My Applications', desc: 'Track your application status and slots', icon: <FileCheck size={16} />, path: '/applications' },
    { title: 'Shortlist Rankings', desc: 'View AVL shortlist tree and ranked candidates', icon: <TrendingUp size={16} />, path: '/rankings' },
    { title: 'Placement Analytics', desc: 'Branch trends and salary distribution', icon: <BarChart3 size={16} />, path: '/analytics' },
    ...(user?.role === 'Placement_Admin'
      ? [{ title: 'Admin Controls', desc: 'Import CSV, schedule interviews, view audit logs', icon: <ShieldAlert size={16} />, path: '/admin' }]
      : []),
    ...(user?.role === 'Student'
      ? [{ title: 'My Profile', desc: 'Edit skills, CGPA, and resume', icon: <User size={16} />, path: '/profile' }]
      : [])
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.desc.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="apni-cmd-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="apni-cmd-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="apni-cmd-input-wrapper">
          <Search size={18} className="apni-cmd-search-icon" />
          <input
            autoFocus
            type="text"
            className="apni-cmd-input"
            placeholder="Type a command or search page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="apni-cmd-list">
          {filtered.length === 0 ? (
            <div className="apni-cmd-empty">No commands match "{query}"</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.path}
                className="apni-cmd-item"
                onClick={() => handleSelect(item.path)}
              >
                <div className="apni-cmd-item__icon">{item.icon}</div>
                <div className="apni-cmd-item__info">
                  <span className="apni-cmd-item__title">{item.title}</span>
                  <span className="apni-cmd-item__desc">{item.desc}</span>
                </div>
                <ArrowRight size={14} className="apni-cmd-item__arrow" />
              </button>
            ))
          )}
        </div>

        <div className="apni-cmd-footer">
          <span>Navigate with mouse or Tab • Esc to close</span>
        </div>
      </div>
    </div>
  );
}
