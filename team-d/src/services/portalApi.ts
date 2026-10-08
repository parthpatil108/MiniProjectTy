import type { Application, PlacementDrive, Role } from '../App';

export const useMockApi = import.meta.env.VITE_USE_MOCK_API !== 'false';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export type AuthSession = { role: Role; name: string; email: string; token: string };

export type LiveConnectionState = 'connected' | 'reconnecting' | 'stale';

export async function login(email: string, _password: string, requestedRole: Role): Promise<AuthSession> {
  if (!useMockApi && apiBaseUrl) return request<AuthSession>('/api/v1/ui/session', { method: 'POST', body: JSON.stringify({ email, password: _password, role: requestedRole }) });
  await wait();
  const names: Record<Role, string> = { Student: 'Priya Sharma', Faculty_TPO: 'Amit Nair', Placement_Admin: 'Rhea Verma' };
  return { role: requestedRole, name: names[requestedRole], email, token: `mock-token-${requestedRole}` };
}

export async function logout(): Promise<void> {
  if (!useMockApi && apiBaseUrl) await request<void>('/api/v1/ui/session', { method: 'DELETE' });
}

export async function fetchCurrentUser(): Promise<AuthSession> {
  if (!useMockApi && apiBaseUrl) return request<AuthSession>('/api/v1/ui/me');
  return { role: 'Student', name: 'Priya Sharma', email: 'student@placify.edu', token: 'mock-token-Student' };
}

export type EligibilityResult = {
  eligible: boolean;
  reason?: string;
  checkedAt: string;
};

export type PlacementSnapshot = {
  totalStudents: number;
  eligibleStudents: number;
  totalApplications: number;
  shortlistedStudents: number;
  selectedStudents: number;
  placedStudents: number;
  branchBreakdown: Array<{ branch: string; applications: number; placed: number }>;
};

const wait = (milliseconds = 260) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (useMockApi || !apiBaseUrl) throw new Error('MOCK_API');
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error('API_UNAVAILABLE');
  return response.json() as Promise<T>;
}

// These adapters are the BFF boundary. Replace the mock responses with Team A/B/C fetch calls when those services are available.
export async function fetchDrives(): Promise<PlacementDrive[]> {
  if (!useMockApi && apiBaseUrl) return request<PlacementDrive[]>('/api/v1/ui/drives');
  await wait();
  return [
    { id: 'DRV-201', company: 'Google', role: 'Software Engineer', package: '24 LPA', branches: ['CSE', 'IT'], deadline: '18 Aug 2026', slots: 18, minimumCgpa: 8.5, backlogs: 'No active backlogs', skills: ['DSA', 'JavaScript'], status: 'Open', applied: true },
    { id: 'DRV-202', company: 'Amazon', role: 'Machine Learning Analyst', package: '18 LPA', branches: ['CSE', 'ECE'], deadline: '20 Aug 2026', slots: 12, minimumCgpa: 8.7, backlogs: 'No active backlogs', skills: ['Python', 'SQL'], status: 'Shortlist', applied: false },
    { id: 'DRV-203', company: 'Deloitte', role: 'Business Technology Analyst', package: '10 LPA', branches: ['CSE', 'IT', 'EEE'], deadline: '24 Aug 2026', slots: 24, minimumCgpa: 7.8, backlogs: 'Maximum 1 backlog', skills: ['Communication', 'Excel'], status: 'Open', applied: false }
  ];
}

export async function checkEligibility(drive: PlacementDrive, student: { cgpa: number; branch: string }): Promise<EligibilityResult> {
  if (!useMockApi && apiBaseUrl) return request<EligibilityResult>('/api/v1/ui/eligibility', { method: 'POST', body: JSON.stringify({ driveId: drive.id, student }) });
  await wait();
  // Team A owns this decision in production. This mock only represents the API response shape.
  const eligible = student.cgpa >= drive.minimumCgpa && drive.branches.includes(student.branch);
  return { eligible, reason: eligible ? undefined : `Team A reported that this drive requires CGPA ${drive.minimumCgpa}+ and branch ${drive.branches.join(', ')}.`, checkedAt: new Date().toLocaleTimeString() };
}

export async function submitApplication(drive: PlacementDrive, studentName: string): Promise<Application> {
  if (!useMockApi && apiBaseUrl) return request<Application>('/api/v1/ui/applications', { method: 'POST', body: JSON.stringify({ driveId: drive.id, studentName }) });
  await wait();
  return { id: `APP-${Math.floor(1100 + Math.random() * 800)}`, name: studentName, role: drive.role, status: 'Applied', cgpa: '9.1', branch: 'CSE', score: '90%', queuePosition: 19, rank: 42, update: `Application submitted for ${drive.company}; awaiting Team C confirmation` };
}

export async function fetchApplication(applicationId: string): Promise<Application> {
  if (!useMockApi && apiBaseUrl) return request<Application>(`/api/v1/ui/applications/${applicationId}`);
  return { id: applicationId, name: 'Priya Sharma', role: 'Software Engineer', status: 'Applied', cgpa: '9.1', branch: 'CSE', score: '90%', queuePosition: 19, rank: 42, update: 'Application state supplied by Team C' };
}

export async function fetchPlacementSnapshot(_role: Role): Promise<PlacementSnapshot> {
  if (!useMockApi && apiBaseUrl) return request<PlacementSnapshot>('/api/v1/ui/dashboard');
  await wait();
  return { totalStudents: 420, eligibleStudents: 286, totalApplications: 612, shortlistedStudents: 128, selectedStudents: 104, placedStudents: 96, branchBreakdown: [{ branch: 'CSE', applications: 224, placed: 42 }, { branch: 'IT', applications: 156, placed: 27 }, { branch: 'ECE', applications: 132, placed: 18 }, { branch: 'EEE', applications: 100, placed: 9 }] };
}

export async function fetchRankings(): Promise<Array<{ rank: number; name: string; score: string; status: string; isCurrentUser?: boolean }>> {
  if (!useMockApi && apiBaseUrl) return request<Array<{ rank: number; name: string; score: string; status: string; isCurrentUser?: boolean }>>('/api/v1/ui/rankings');
  await wait();
  return [
    { rank: 1, name: 'Ananya Rao', score: '96%', status: 'Shortlisted' },
    { rank: 2, name: 'Rahul Menon', score: '94%', status: 'Shortlisted' },
    { rank: 3, name: 'Priya Sharma', score: '92%', status: 'Shortlisted', isCurrentUser: true },
    { rank: 4, name: 'Neha R.', score: '90%', status: 'Under review' }
  ];
}

export async function updateDrive(driveId: string, changes: Partial<PlacementDrive>): Promise<PlacementDrive> {
  if (!useMockApi && apiBaseUrl) return request<PlacementDrive>(`/api/v1/ui/drives/${driveId}`, { method: 'PATCH', body: JSON.stringify(changes) });
  const drives = await fetchDrives();
  const drive = drives.find((item) => item.id === driveId);
  if (!drive) throw new Error('DRIVE_NOT_FOUND');
  return { ...drive, ...changes };
}

export async function fetchPlacementReport(): Promise<PlacementSnapshot> {
  if (!useMockApi && apiBaseUrl) return request<PlacementSnapshot>('/api/v1/ui/reports/placement-performance');
  return fetchPlacementSnapshot('Faculty_TPO');
}

export async function previewRankings(): Promise<Array<{ rank: number; name: string; score: string; status: string }>> {
  if (!useMockApi && apiBaseUrl) return request<Array<{ rank: number; name: string; score: string; status: string }>>('/api/v1/ui/rankings/preview', { method: 'POST' });
  return fetchRankings();
}

export async function fetchPlacementUpdates(): Promise<Array<{ id: number; title: string; detail: string; time: string; type: string }>> {
  await wait();
  return [
    { id: 1, title: 'Interview scheduled', detail: 'Google SDE interview slot confirmed for 29 August.', time: '2 min ago', type: 'success' },
    { id: 2, title: 'Ranking updated', detail: 'Your Team B ranking moved to #3.', time: '18 min ago', type: 'info' },
    { id: 3, title: 'Drive closing soon', detail: 'Amazon ML applications close on 20 August.', time: '1 hr ago', type: 'warning' }
  ];
}

export function subscribeToLiveUpdates(onUpdate: (message: string) => void, onStateChange?: (state: LiveConnectionState) => void): () => void {
  if (!useMockApi && apiBaseUrl && typeof EventSource !== 'undefined') {
    const source = new EventSource(`${apiBaseUrl}/api/v1/ui/stream`);
    onStateChange?.('connected');
    source.onmessage = (event) => { onStateChange?.('connected'); onUpdate(event.data); };
    source.onerror = () => onStateChange?.('reconnecting');
    return () => source.close();
  }
  onStateChange?.('connected');
  const timer = window.setInterval(() => onUpdate('Placement feed heartbeat received; dashboard data is current.'), 10000);
  return () => window.clearInterval(timer);
}
