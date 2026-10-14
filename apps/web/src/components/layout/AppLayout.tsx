import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileCheck,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  User,
  LogOut,
  Sun,
  Moon,
  Search,
  Bell,
  Menu,
  X,
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLiveOutbox } from '../../services/sse';
import { Badge } from '../../design-system/Badge';
import { CommandPalette } from './CommandPalette';
import { NotificationDrawer } from './NotificationDrawer';
import { ErrorBoundary } from '../../design-system/ErrorBoundary';
import './AppLayout.css';

export function AppLayout() {
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { status: sseStatus } = useLiveOutbox();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="apni-app">
      {/* Top Navbar */}
      <header className="apni-topbar glass-panel">
        <div className="apni-topbar__left">
          <button
            className="apni-topbar__menu-btn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <NavLink to="/" className="apni-brand">
            <span className="apni-brand__logo">A</span>
            <span className="apni-brand__name">
              Apni<span className="apni-brand__accent">Leap</span>
            </span>
          </NavLink>

          <div className="apni-status-indicator" title={`Real-time sync: ${sseStatus}`}>
            <span className={`apni-status-dot apni-status-dot--${sseStatus}`} />
            <span className="apni-status-text">
              {sseStatus === 'connected' ? 'Live' : sseStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="apni-topbar__center">
          <button
            className="apni-search-trigger"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Quick search (Ctrl+K)"
          >
            <Search size={15} className="apni-search-trigger__icon" />
            <span className="apni-search-trigger__text">Search drives, candidates, commands...</span>
            <kbd className="apni-search-trigger__kbd">⌘K</kbd>
          </button>
        </div>

        <div className="apni-topbar__right">
          <button
            className="apni-icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            className="apni-icon-btn"
            onClick={() => {
              setNotificationsOpen(true);
              setUnreadCount(0);
            }}
            aria-label="Open notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="apni-badge-counter">{unreadCount}</span>}
          </button>

          <div className="apni-user-badge">
            <div className="apni-user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="apni-user-details desktop-only">
              <span className="apni-user-name">{user?.name || user?.user_id}</span>
              <span className="apni-user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
            <button
              className="apni-icon-btn apni-logout-btn"
              onClick={handleLogout}
              title="Sign out of ApniLeap"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="apni-body">
        {/* Sidebar Navigation */}
        <aside className={`apni-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
          <nav className="apni-nav" aria-label="Main Navigation">
            <div className="apni-nav__group">
              <span className="apni-nav__header">MAIN PORTAL</span>

              <NavLink
                to="/"
                end
                className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/drives"
                className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Briefcase size={18} />
                <span>Placement Drives</span>
              </NavLink>

              <NavLink
                to="/applications"
                className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileCheck size={18} />
                <span>{user?.role === 'Student' ? 'My Applications' : 'Applications'}</span>
              </NavLink>
            </div>

            <div className="apni-nav__group">
              <span className="apni-nav__header">INTELLIGENCE</span>

              <NavLink
                to="/rankings"
                className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <TrendingUp size={18} />
                <span>Shortlist Engine</span>
              </NavLink>

              <NavLink
                to="/analytics"
                className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <BarChart3 size={18} />
                <span>Placement Analytics</span>
              </NavLink>
            </div>

            {user?.role === 'Placement_Admin' && (
              <div className="apni-nav__group">
                <span className="apni-nav__header">MANAGEMENT</span>
                <NavLink
                  to="/admin"
                  className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ShieldAlert size={18} />
                  <span>Admin Controls</span>
                </NavLink>
              </div>
            )}

            {user?.role === 'Student' && (
              <div className="apni-nav__group">
                <span className="apni-nav__header">ACCOUNT</span>
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `apni-nav__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User size={18} />
                  <span>Candidate Profile</span>
                </NavLink>
              </div>
            )}
          </nav>

          <div className="apni-sidebar__footer">
            <div className="apni-service-tag">
              <span className="apni-service-tag__title">ApniLeap Engine</span>
              <span className="apni-service-tag__version">v1.0 Production</span>
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="apni-main" id="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Slide-over Notifications */}
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}
