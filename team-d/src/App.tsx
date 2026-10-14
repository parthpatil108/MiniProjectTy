import { useEffect, useMemo, useState } from 'react';
import { DashboardView } from './components/DashboardView';
import { LoginScreen } from './components/LoginScreen';
import { ApplicationsView } from './components/ApplicationsView';
import { DrivesView } from './components/DrivesView';
import { ReportsView } from './components/ReportsView';
import { RankingsView } from './components/RankingsView';
import { ProfileView } from './components/ProfileView';
import { AdminActionsView } from './components/AdminActionsView';
import { AnalyticsView } from './components/AnalyticsView';
import { CommandPalette } from './components/CommandPalette';
import { NotificationDrawer } from './components/NotificationDrawer';
import {
  fetchDrives,
  login,
  logout,
  submitApplication,
  subscribeToLiveUpdates,
  updateDrive,
  type AuthSession,
  type LiveConnectionState
} from './services/portalApi';

export type Role = 'Student' | 'Faculty_TPO' | 'Placement_Admin';

type UserSession = AuthSession;

export type Application = {
  id: string;
  name: string;
  role: string;
  status: string;
  cgpa: string;
  branch: string;
  score: string;
  queuePosition: number;
  rank: number;
  update: string;
};

export type PlacementDrive = {
  id: string;
  company: string;
  role: string;
  package: string;
  branches: string[];
  deadline: string;
  slots: number;
  minimumCgpa: number;
  status: string;
  backlogs: string;
  skills: string[];
  applied: boolean;
};

export type DashboardData = {
  stats: Array<{ label: string; value: string; tone: string }>;
  applications: Application[];
  liveEvents: Array<{ id: number; text: string; time: string }>;
};

export type View =
  | 'Dashboard'
  | 'Applications'
  | 'Drives'
  | 'Rankings'
  | 'Analytics'
  | 'Reports'
  | 'Profile'
  | 'AdminActions';

const navigationByRole: Record<Role, Array<{ group: string; items: View[] }>> = {
  Student: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Opportunities', items: ['Drives'] },
    { group: 'My Placement', items: ['Applications', 'Rankings'] },
    { group: 'Account', items: ['Profile'] }
  ],
  Faculty_TPO: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Operations', items: ['Drives', 'Applications'] },
    { group: 'Insights & Merit', items: ['Rankings', 'Analytics', 'Reports'] }
  ],
  Placement_Admin: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Management', items: ['Drives', 'AdminActions', 'Applications'] },
    { group: 'Insights & Merit', items: ['Rankings', 'Analytics', 'Reports'] }
  ]
};

const viewLabels: Record<View, string> = {
  Dashboard: 'Dashboard',
  Drives: 'Placement Drives',
  Applications: 'Applications',
  Rankings: 'Rankings & Merit',
  Analytics: 'Analytics',
  Reports: 'Reports',
  AdminActions: 'Drive Management',
  Profile: 'Profile'
};

const statsByRole: Record<Role, Array<{ label: string; value: string; tone: string }>> = {
  Student: [
    { label: 'Applications', value: '04', tone: 'blue' },
    { label: 'Shortlisted', value: '02', tone: 'green' },
    { label: 'Interviews', value: '01', tone: 'purple' }
  ],
  Faculty_TPO: [
    { label: 'Eligible', value: '128', tone: 'blue' },
    { label: 'Placed', value: '96', tone: 'green' },
    { label: 'Active Drives', value: '05', tone: 'purple' }
  ],
  Placement_Admin: [
    { label: 'Open Drives', value: '05', tone: 'blue' },
    { label: 'Offers Issued', value: '42', tone: 'green' },
    { label: 'Pending Review', value: '17', tone: 'purple' }
  ]
};

const initialApplications: Application[] = [
  {
    id: 'APP-1042',
    name: 'Neha R.',
    role: 'Software Engineer',
    status: 'Shortlisted',
    cgpa: '9.4',
    branch: 'CSE',
    score: '92%',
    queuePosition: 3,
    rank: 8,
    update: 'Interview slot lease confirmed by Team A lock manager'
  },
  {
    id: 'APP-1048',
    name: 'Aditya S.',
    role: 'Data Analyst',
    status: 'Interview Scheduled',
    cgpa: '8.9',
    branch: 'IT',
    score: '88%',
    queuePosition: 6,
    rank: 14,
    update: 'Technical interview scheduled; slot lock lease acquired'
  },
  {
    id: 'APP-1053',
    name: 'Kavya M.',
    role: 'Frontend Developer',
    status: 'Screening',
    cgpa: '9.1',
    branch: 'ECE',
    score: '90%',
    queuePosition: 12,
    rank: 21,
    update: 'Team A eligibility rule chain passed; queued for ranking'
  },
  {
    id: 'APP-1058',
    name: 'Rohan P.',
    role: 'QA Engineer',
    status: 'Applied',
    cgpa: '8.7',
    branch: 'EEE',
    score: '84%',
    queuePosition: 18,
    rank: 36,
    update: 'Application received and written to Team C WAL journal'
  }
];

const initialDashboard: DashboardData = {
  stats: statsByRole.Student,
  applications: initialApplications,
  liveEvents: [
    { id: 1, text: 'Application APP-1042 moved to Shortlisted (Team B ranking)', time: '2s ago' },
    { id: 2, text: 'Google interview slot lock lease acquired by Team A', time: '11s ago' },
    { id: 3, text: 'Eligibility evaluated against rule chain: CGPA >= 8.5', time: '23s ago' },
    { id: 4, text: 'Team C outbox stream: WAL commit checkpoint verified', time: '1m ago' }
  ]
};

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem('placify-session');
    return saved ? (JSON.parse(saved) as UserSession) : null;
  });
  const [selectedRole, setSelectedRole] = useState<Role>('Student');
  const [currentView, setCurrentView] = useState<View>('Dashboard');
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialApplications[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [availableDrives, setAvailableDrives] = useState<PlacementDrive[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [liveState, setLiveState] = useState<LiveConnectionState>('connected');
  const [globalSearch, setGlobalSearch] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [savedDriveIds, setSavedDriveIds] = useState<string[]>(() => {
    try {
      return (JSON.parse(localStorage.getItem('placify-saved-drives') ?? '[]') as string[]) || [];
    } catch {
      return [];
    }
  });

  const stats = useMemo(() => dashboard.stats, [dashboard.stats]);
  const selectedApplication =
    dashboard.applications.find((app) => app.id === selectedAppId) ?? dashboard.applications[0];

  const loadDashboard = (role: Role) => {
    setIsLoading(true);
    setApiError('');

    window.setTimeout(() => {
      const nextDashboard: DashboardData = {
        stats: statsByRole[role],
        applications: initialApplications,
        liveEvents: [
          {
            id: Date.now() - 2000,
            text: `${role === 'Faculty_TPO' ? 'Faculty review' : 'Application'} APP-1042 moved to Shortlisted`,
            time: '2s ago'
          },
          { id: Date.now() - 11000, text: 'Drive update: Google interview slot confirmed', time: '11s ago' },
          { id: Date.now() - 23000, text: 'Eligibility results refreshed from Team A engine', time: '23s ago' },
          { id: Date.now() - 60000, text: 'Team C outbox stream received new atomic commit', time: '1m ago' }
        ]
      };

      setDashboard(nextDashboard);
      setSelectedAppId(nextDashboard.applications[0].id);
      setIsLoading(false);
    }, 180);
  };

  useEffect(() => {
    if (!session) return;
    loadDashboard(session.role);
    setIsDriveLoading(true);
    fetchDrives()
      .then(setAvailableDrives)
      .catch(() => setDriveError('Unable to load placement drives. The drive service is temporarily unavailable.'))
      .finally(() => setIsDriveLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    return subscribeToLiveUpdates(
      (message) =>
        setDashboard((current) => ({
          ...current,
          liveEvents: [{ id: Date.now(), text: message, time: 'just now' }, ...current.liveEvents].slice(0, 10)
        })),
      setLiveState
    );
  }, [session]);

  const handleLogin = async (email: string, password: string) => {
    const nextSession = await login(email, password, selectedRole);
    sessionStorage.setItem('placify-session', JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const handleLogout = () => {
    void logout();
    sessionStorage.removeItem('placify-session');
    setSession(null);
    setApiError('');
    setIsLoading(false);
  };

  const handleApply = async (driveId: string) => {
    const drive = availableDrives.find((item) => item.id === driveId);
    if (!drive) return;
    const nextApp = await submitApplication(drive, session?.name ?? 'Priya Sharma');
    setAvailableDrives((current) =>
      current.map((d) => (d.id === driveId ? { ...d, applied: true } : d))
    );
    setDashboard((current) => ({
      ...current,
      applications: [nextApp, ...current.applications],
      stats: current.stats.map((st) =>
        st.label === 'Applications' ? { ...st, value: String(Number(st.value) + 1).padStart(2, '0') } : st
      ),
      liveEvents: [
        { id: Date.now(), text: `Application submitted for ${drive.company} · Team C committed`, time: 'just now' },
        ...current.liveEvents
      ]
    }));
  };

  const handleDriveUpdate = async () => {
    const drive = availableDrives[0];
    if (!drive) return;
    const nextStatus = drive.status === 'Open' ? 'Paused' : 'Open';
    const updated = await updateDrive(drive.id, { status: nextStatus });
    setAvailableDrives((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, status: nextStatus } : item))
    );
  };

  const toggleSavedDrive = (driveId: string) => {
    setSavedDriveIds((current) => {
      const next = current.includes(driveId)
        ? current.filter((id) => id !== driveId)
        : [...current, driveId];
      localStorage.setItem('placify-saved-drives', JSON.stringify(next));
      return next;
    });
  };

  if (!session) {
    return (
      <LoginScreen
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onLogin={handleLogin}
      />
    );
  }

  if (isLoading) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="spinner" />
          <h2>Loading placement portal...</h2>
          <p>Connecting to Team A (OS Engine), Team B (Data Structures), and Team C (Custom DBMS)...</p>
        </div>
      </main>
    );
  }

  if (apiError) {
    return (
      <main className="loading-page">
        <div className="loading-card error-card">
          <h2>Unable to load dashboard</h2>
          <p>{apiError}</p>
          <button type="button" className="primary-button" onClick={() => loadDashboard(session.role)}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo">CP</span>
          <div>
            <strong>PLACIFY</strong>
            <small>Campus Placement Intelligence</small>
          </div>
        </div>

        <nav className="nav">
          {navigationByRole[session.role].map((section) => (
            <div className="nav-section" key={section.group}>
              <span className="nav-label">{section.group}</span>
              {section.items.map((view) => (
                <button
                  key={view}
                  className={`nav-item ${currentView === view ? 'active' : ''}`}
                  type="button"
                  onClick={() => setCurrentView(view)}
                >
                  <span className="nav-glyph">
                    {view === 'Dashboard'
                      ? '⌂'
                      : view === 'Drives'
                      ? '▣'
                      : view === 'Applications'
                      ? '▤'
                      : view === 'Rankings'
                      ? '◒'
                      : view === 'Analytics'
                      ? '📈'
                      : view === 'Reports'
                      ? '📄'
                      : view === 'AdminActions'
                      ? '⚙'
                      : '○'}
                  </span>
                  {viewLabels[view]}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="user-card">
          <p>Signed in as</p>
          <strong>{session.name}</strong>
          <span>
            {session.role === 'Faculty_TPO'
              ? 'Faculty / TPO'
              : session.role === 'Placement_Admin'
              ? 'Placement Admin'
              : 'CSE · 4th Year'}
          </span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="global-header">
          <div className="global-brand">
            <strong>PLACIFY</strong>
            <span>Campus Placement Intelligence · RIT Placement &amp; Career Cell</span>
          </div>

          <div className="global-tools">
            <label className="global-search">
              <span>⌕</span>
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    setCurrentView('Drives');
                  }
                }}
                placeholder="Search placement drives..."
                aria-label="Search PLACIFY"
              />
            </label>

            <CommandPalette role={session.role} onNavigate={setCurrentView} />

            <button
              className="header-icon"
              type="button"
              onClick={() => setIsNotificationOpen(true)}
              aria-label="Open notifications"
              title="Live Stream Notices"
            >
              ♢
            </button>

            <span className="header-user">
              {session.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </span>
          </div>
        </header>

        {currentView === 'Dashboard' && (
          <DashboardView
            stats={stats}
            applications={dashboard.applications}
            liveEvents={dashboard.liveEvents}
            selectedAppId={selectedAppId}
            selectedApplication={selectedApplication}
            onSelectApplication={setSelectedAppId}
            liveState={liveState}
            role={session.role}
            onNavigate={setCurrentView}
            onOpenNotifications={() => setIsNotificationOpen(true)}
          />
        )}

        {currentView === 'Drives' && (
          <DrivesView
            drives={availableDrives}
            studentCgpa={9.1}
            studentBranch="CSE"
            onApply={handleApply}
            isLoading={isDriveLoading}
            error={driveError}
            savedDriveIds={savedDriveIds}
            onToggleSaved={toggleSavedDrive}
          />
        )}

        {currentView === 'Applications' && (
          <ApplicationsView applications={dashboard.applications} />
        )}

        {currentView === 'Rankings' && <RankingsView />}

        {currentView === 'Analytics' && <AnalyticsView role={session.role} />}

        {currentView === 'Reports' && <ReportsView role={session.role} />}

        {currentView === 'AdminActions' && (
          <AdminActionsView onUpdateDrive={handleDriveUpdate} />
        )}

        {currentView === 'Profile' && <ProfileView session={session} />}
      </section>

      {/* Notification Slideout Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        events={dashboard.liveEvents}
        liveState={liveState}
        onClear={() => setDashboard((prev) => ({ ...prev, liveEvents: [] }))}
      />
    </main>
  );
}
