import { useEffect, useMemo, useState } from 'react';
import { DashboardView } from './components/DashboardView';
import { LoginScreen } from './components/LoginScreen';
import { ApplicationsView } from './components/ApplicationsView';
import { DrivesView } from './components/DrivesView';
import { ReportsView } from './components/ReportsView';
import { RankingsView } from './components/RankingsView';
import { UpdatesView } from './components/UpdatesView';
import { ProfileView } from './components/ProfileView';
import { AdminActionsView } from './components/AdminActionsView';
import { JourneyView } from './components/JourneyView';
import { CalendarView } from './components/CalendarView';
import { InterviewView } from './components/InterviewView';
import { InboxView } from './components/InboxView';
import { AnalyticsView } from './components/AnalyticsView';
import { ActivityView } from './components/ActivityView';
import { CommandPalette } from './components/CommandPalette';
import { SavedDrivesView } from './components/SavedDrivesView';
import { fetchDrives, login, logout, submitApplication, subscribeToLiveUpdates, updateDrive, type AuthSession, type LiveConnectionState } from './services/portalApi';

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
  saved?: boolean;
};

export type DashboardData = {
  stats: Array<{ label: string; value: string; tone: string }>;
  applications: Application[];
  liveEvents: Array<{ id: number; text: string; time: string }>;
};

export type View = 'Dashboard' | 'Applications' | 'Drives' | 'SavedDrives' | 'Rankings' | 'Journey' | 'Calendar' | 'Interview' | 'Inbox' | 'Updates' | 'Analytics' | 'Reports' | 'Profile' | 'AdminActions' | 'Activity';

const navigationByRole: Record<Role, Array<{ group: string; items: View[] }>> = {
  Student: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Opportunities', items: ['Drives', 'SavedDrives'] },
    { group: 'My placement', items: ['Applications', 'Rankings', 'Journey', 'Calendar'] },
    { group: 'Communication', items: ['Inbox', 'Updates'] },
    { group: 'Account', items: ['Profile'] }
  ],
  Faculty_TPO: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Operations', items: ['Drives', 'Applications', 'Calendar'] },
    { group: 'Insights', items: ['Analytics', 'Reports'] },
    { group: 'System', items: ['Updates', 'Activity'] }
  ],
  Placement_Admin: [
    { group: 'Overview', items: ['Dashboard'] },
    { group: 'Management', items: ['Drives', 'Applications', 'AdminActions'] },
    { group: 'Insights', items: ['Analytics', 'Reports'] },
    { group: 'System', items: ['Activity', 'Updates'] }
  ]
};

const viewLabels: Record<View, string> = {
  Dashboard: 'Dashboard', Applications: 'Applications', Drives: 'Placement Drives', SavedDrives: 'Saved Drives', Rankings: 'Rankings', Journey: 'My Journey', Calendar: 'Calendar', Interview: 'Interview Workspace', Inbox: 'Inbox', Updates: 'Notifications', Analytics: 'Analytics', Reports: 'Reports', Profile: 'Profile', AdminActions: 'Drive Management', Activity: 'Activity'
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
    { label: 'Drives', value: '06', tone: 'purple' }
  ],
  Placement_Admin: [
    { label: 'Open Drives', value: '08', tone: 'blue' },
    { label: 'Offers', value: '42', tone: 'green' },
    { label: 'Pending', value: '17', tone: 'purple' }
  ]
};

const applications: Application[] = [
  { id: 'APP-1042', name: 'Neha R.', role: 'Software Engineer', status: 'Shortlisted', cgpa: '9.4', branch: 'CSE', score: '92%', queuePosition: 3, rank: 8, update: 'Interview slot confirmed for 29 Aug' },
  { id: 'APP-1048', name: 'Aditya S.', role: 'Data Analyst', status: 'Interview', cgpa: '8.9', branch: 'IT', score: '88%', queuePosition: 6, rank: 14, update: 'Technical interview under review' },
  { id: 'APP-1053', name: 'Kavya M.', role: 'Frontend Developer', status: 'Eligible', cgpa: '9.1', branch: 'ECE', score: '90%', queuePosition: 12, rank: 21, update: 'Awaiting shortlist announcement' },
  { id: 'APP-1058', name: 'Rohan P.', role: 'QA Engineer', status: 'Applied', cgpa: '8.7', branch: 'EEE', score: '84%', queuePosition: 18, rank: 36, update: 'Application received by Placement Cell' }
];

const initialDashboard: DashboardData = {
  stats: statsByRole.Student,
  applications,
  liveEvents: [
    { id: 1, text: 'Application APP-1042 moved to shortlisted', time: '2s ago' },
    { id: 2, text: 'Drive update: Google interview slot confirmed', time: '11s ago' },
    { id: 3, text: 'Eligibility results refreshed from Team A', time: '23s ago' },
    { id: 4, text: 'Team C outbox stream received a new status event', time: '1m ago' }
  ]
};

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    const savedSession = sessionStorage.getItem('placify-session');
    return savedSession ? JSON.parse(savedSession) as UserSession : null;
  });
  const [selectedRole, setSelectedRole] = useState<Role>('Student');
  const [currentView, setCurrentView] = useState<View>('Dashboard');
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard);
  const [selectedAppId, setSelectedAppId] = useState<string>(applications[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [availableDrives, setAvailableDrives] = useState<PlacementDrive[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [liveState, setLiveState] = useState<LiveConnectionState>('connected');
  const [globalSearch, setGlobalSearch] = useState('');
  const [savedDriveIds, setSavedDriveIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('placify-saved-drives') ?? '[]') as string[]);

  const stats = useMemo(() => dashboard.stats, [dashboard.stats]);
  const selectedApplication = dashboard.applications.find((app) => app.id === selectedAppId) ?? dashboard.applications[0];

  const loadDashboard = (role: Role) => {
    setIsLoading(true);
    setApiError('');

    window.setTimeout(() => {
      const nextDashboard: DashboardData = {
        stats: statsByRole[role],
        applications,
        liveEvents: [
          { id: 1, text: `${role === 'Faculty_TPO' ? 'Faculty review' : 'Application'} APP-1042 moved to shortlisted`, time: '2s ago' },
          { id: 2, text: 'Drive update: Google interview slot confirmed', time: '11s ago' },
          { id: 3, text: 'Eligibility results refreshed from Team A', time: '23s ago' },
          { id: 4, text: 'Team C outbox stream received a new status event', time: '1m ago' }
        ]
      };

      setDashboard(nextDashboard);
      setSelectedAppId(nextDashboard.applications[0].id);
      setIsLoading(false);
    }, 700);
  };

  useEffect(() => {
    if (!session) return;
    loadDashboard(session.role);
    setIsDriveLoading(true);
    fetchDrives().then(setAvailableDrives).catch(() => setDriveError('Unable to load placement drives. The drive service is temporarily unavailable.')).finally(() => setIsDriveLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    return subscribeToLiveUpdates((message) => setDashboard((currentDashboard) => ({
      ...currentDashboard,
      liveEvents: [{ id: Date.now(), text: message, time: 'just now' }, ...currentDashboard.liveEvents].slice(0, 5)
    })), setLiveState);
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

  const handleRetry = () => {
    if (session) {
      loadDashboard(session.role);
    }
  };

  const handleApply = async (driveId: string) => {
    const drive = availableDrives.find((item) => item.id === driveId);
    if (!drive) return;
    const nextApplication = await submitApplication(drive, session?.name ?? 'Priya Sharma');
    setAvailableDrives((currentDrives) => currentDrives.map((drive) => drive.id === driveId ? { ...drive, applied: true } : drive));
    setDashboard((currentDashboard) => ({
      ...currentDashboard,
      applications: [nextApplication, ...currentDashboard.applications],
      stats: currentDashboard.stats.map((stat) => stat.label === 'Applications' ? { ...stat, value: String(Number(stat.value) + 1).padStart(2, '0') } : stat),
      liveEvents: [{ id: Date.now(), text: `Application submitted for ${drive.company}`, time: 'just now' }, ...currentDashboard.liveEvents]
    }));
  };

  const handleDriveUpdate = async () => {
    const drive = availableDrives[0];
    if (!drive) return;
    const updatedDrive = await updateDrive(drive.id, { status: drive.status === 'Open' ? 'Paused' : 'Open' });
    setAvailableDrives((currentDrives) => currentDrives.map((item) => item.id === updatedDrive.id ? updatedDrive : item));
  };

  const toggleSavedDrive = (driveId: string) => {
    setSavedDriveIds((current) => { const next = current.includes(driveId) ? current.filter((id) => id !== driveId) : [...current, driveId]; localStorage.setItem('placify-saved-drives', JSON.stringify(next)); return next; });
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
          <h2>Loading dashboard...</h2>
          <p>Fetching aggregate data from Team A, Team B, and Team C.</p>
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
          <button type="button" className="primary-button" onClick={handleRetry}>Retry</button>
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
              {section.items.map((view) => <button key={view} className={`nav-item ${currentView === view ? 'active' : ''}`} type="button" onClick={() => setCurrentView(view)}><span className="nav-glyph">{view === 'Dashboard' ? '⌂' : view === 'Drives' || view === 'SavedDrives' ? '▣' : view === 'Applications' ? '▤' : view === 'Analytics' || view === 'Reports' ? '◒' : view === 'Profile' ? '○' : '·'}</span>{viewLabels[view]}</button>)}
            </div>
          ))}
        </nav>

        <div className="user-card">
          <p>Signed in as</p>
          <strong>{session.name}</strong>
          <span>{session.role === 'Faculty_TPO' ? 'Faculty / TPO' : session.role === 'Placement_Admin' ? 'Placement Admin' : 'CSE · 4th Year'}</span>
          <button type="button" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <section className="content-panel">
        <header className="global-header"><div className="global-brand"><strong>PLACIFY</strong><span>Campus Placement Intelligence · RIT Placement &amp; Career Cell</span></div><div className="global-tools"><label className="global-search"><span>⌕</span><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && globalSearch.trim()) setCurrentView('Drives'); }} placeholder="Search PLACIFY..." aria-label="Search PLACIFY" /></label><CommandPalette role={session.role} onNavigate={setCurrentView} /><button className="header-icon" type="button" onClick={() => setCurrentView(session.role === 'Student' ? 'Inbox' : 'Updates')} aria-label="Open notifications">♢</button><span className="header-user">{session.name.split(' ').map((part) => part[0]).join('')}</span></div></header>
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
          />
        )}

        {currentView === 'Applications' && (
          <ApplicationsView applications={dashboard.applications} />
        )}

        {currentView === 'Drives' && (
          <DrivesView drives={availableDrives} studentCgpa={9.1} studentBranch="CSE" onApply={handleApply} isLoading={isDriveLoading} error={driveError} savedDriveIds={savedDriveIds} onToggleSaved={toggleSavedDrive} />
        )}
        {currentView === 'SavedDrives' && <SavedDrivesView drives={availableDrives} savedDriveIds={savedDriveIds} onToggleSaved={toggleSavedDrive} onNavigate={setCurrentView} />}

        {currentView === 'Rankings' && <RankingsView />}
        {currentView === 'Journey' && <JourneyView onNavigate={setCurrentView} />}
        {currentView === 'Calendar' && <CalendarView role={session.role} onNavigate={setCurrentView} />}
        {currentView === 'Interview' && <InterviewView />}
        {currentView === 'Inbox' && <InboxView onNavigate={setCurrentView} />}
        {currentView === 'Updates' && <UpdatesView />}
        {currentView === 'Analytics' && <AnalyticsView role={session.role} />}
        {currentView === 'Activity' && <ActivityView />}
        {currentView === 'Profile' && <ProfileView session={session} />}
        {currentView === 'AdminActions' && session.role === 'Placement_Admin' && <AdminActionsView onUpdateDrive={handleDriveUpdate} />}
        {currentView === 'Reports' && (
          <ReportsView role={session.role} />
        )}
      </section>
    </main>
  );
}
