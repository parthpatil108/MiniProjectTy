import type { Application, PlacementDrive, Role } from '../App';

export const useMockApi = import.meta.env.VITE_USE_MOCK_API !== 'false';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export type AuthSession = {
  role: Role;
  name: string;
  email: string;
  token: string;
};

export type LiveConnectionState = 'connected' | 'reconnecting' | 'stale';

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

const wait = (milliseconds = 120) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (useMockApi) throw new Error('MOCK_API');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error('API_UNAVAILABLE');
  const json: any = await response.json();
  return (json && json.data !== undefined ? json.data : json) as T;
}

export async function login(email: string, _password: string, requestedRole: Role): Promise<AuthSession> {
  if (!useMockApi) {
    try {
      return await request<AuthSession>('/api/v1/ui/session', {
        method: 'POST',
        body: JSON.stringify({ email, password: _password, role: requestedRole })
      });
    } catch {}
  }
  await wait();
  const names: Record<Role, string> = {
    Student: 'Priya Sharma',
    Faculty_TPO: 'Amit Nair',
    Placement_Admin: 'Rhea Verma'
  };
  return {
    role: requestedRole,
    name: names[requestedRole],
    email,
    token: `mock-token-${requestedRole}`
  };
}

export async function logout(): Promise<void> {
  if (!useMockApi) {
    try {
      await request<void>('/api/v1/ui/session', { method: 'DELETE' });
    } catch {}
  }
}

export async function fetchCurrentUser(): Promise<AuthSession> {
  if (!useMockApi) {
    try {
      return await request<AuthSession>('/api/v1/ui/me');
    } catch {}
  }
  return {
    role: 'Student',
    name: 'Priya Sharma',
    email: 'student@placify.edu',
    token: 'mock-token-Student'
  };
}

export async function fetchDrives(): Promise<PlacementDrive[]> {
  if (!useMockApi) {
    try {
      const rawDrives = await request<any[]>('/api/v1/ui/drives');
      if (Array.isArray(rawDrives) && rawDrives.length > 0) {
        return rawDrives.map((d: any, idx: number) => ({
          id: d.drive_id ?? `DRV-20${idx + 1}`,
          company: d.company ?? 'Corporate Partner',
          role: d.role ?? 'Software Engineer',
          package: d.package ?? '12 LPA',
          branches: d.criteria?.allowed_branches ?? ['CSE', 'IT'],
          deadline: '30 Aug 2026',
          slots: d.seats ?? 10,
          minimumCgpa: d.criteria?.min_cgpa ?? 7.5,
          backlogs: d.criteria?.max_backlogs === 0 ? 'No active backlogs' : `Max ${d.criteria?.max_backlogs} backlog`,
          skills: d.criteria?.required_skill_tags ?? ['TypeScript', 'Node.js'],
          status: d.state === 'OPEN' ? 'Open' : d.state ?? 'Open',
          applied: false
        }));
      }
    } catch {}
  }
  await wait();
  return [
    {
      id: 'DRV-201',
      company: 'Google',
      role: 'Software Engineer',
      package: '24 LPA',
      branches: ['CSE', 'IT'],
      deadline: '18 Aug 2026',
      slots: 18,
      minimumCgpa: 8.5,
      backlogs: 'No active backlogs',
      skills: ['DSA', 'JavaScript', 'Algorithms'],
      status: 'Open',
      applied: true
    },
    {
      id: 'DRV-202',
      company: 'Amazon',
      role: 'Machine Learning Analyst',
      package: '18 LPA',
      branches: ['CSE', 'ECE'],
      deadline: '20 Aug 2026',
      slots: 12,
      minimumCgpa: 8.7,
      backlogs: 'No active backlogs',
      skills: ['Python', 'SQL', 'PyTorch'],
      status: 'Open',
      applied: false
    },
    {
      id: 'DRV-203',
      company: 'Deloitte',
      role: 'Business Technology Analyst',
      package: '10 LPA',
      branches: ['CSE', 'IT', 'EEE'],
      deadline: '24 Aug 2026',
      slots: 24,
      minimumCgpa: 7.8,
      backlogs: 'Maximum 1 backlog',
      skills: ['Communication', 'Excel', 'Cloud'],
      status: 'Open',
      applied: false
    },
    {
      id: 'DRV-204',
      company: 'TechCorp Inc.',
      role: 'Backend Platform Engineer',
      package: '12 LPA',
      branches: ['CSE', 'IT', 'ECE'],
      deadline: '28 Aug 2026',
      slots: 8,
      minimumCgpa: 7.5,
      backlogs: 'No active backlogs',
      skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
      status: 'Open',
      applied: false
    },
    {
      id: 'DRV-205',
      company: 'InnovateX Labs',
      role: 'Applied AI Researcher',
      package: '20 LPA',
      branches: ['CSE', 'IT'],
      deadline: '02 Sep 2026',
      slots: 4,
      minimumCgpa: 8.5,
      backlogs: 'No active backlogs',
      skills: ['Deep Learning', 'Python', 'Algorithms'],
      status: 'Open',
      applied: false
    }
  ];
}

export async function checkEligibility(
  drive: PlacementDrive,
  student: { cgpa: number; branch: string }
): Promise<EligibilityResult> {
  if (!useMockApi) {
    try {
      return await request<EligibilityResult>('/api/v1/ui/eligibility', {
        method: 'POST',
        body: JSON.stringify({ driveId: drive.id, student })
      });
    } catch {}
  }
  await wait();
  const eligible = student.cgpa >= drive.minimumCgpa && drive.branches.includes(student.branch);
  return {
    eligible,
    reason: eligible
      ? undefined
      : `Team A reported that this drive requires CGPA ${drive.minimumCgpa}+ and branch ${drive.branches.join(', ')}.`,
    checkedAt: new Date().toLocaleTimeString()
  };
}

export async function submitApplication(drive: PlacementDrive, studentName: string): Promise<Application> {
  if (!useMockApi) {
    try {
      return await request<Application>('/api/v1/ui/applications', {
        method: 'POST',
        body: JSON.stringify({ driveId: drive.id, studentName })
      });
    } catch {}
  }
  await wait();
  return {
    id: `APP-${Math.floor(1100 + Math.random() * 800)}`,
    name: studentName,
    role: drive.role,
    status: 'Applied',
    cgpa: '9.1',
    branch: 'CSE',
    score: '90%',
    queuePosition: 19,
    rank: 42,
    update: `Application submitted for ${drive.company}; committed by Team C custom DBMS`
  };
}

export async function fetchApplication(applicationId: string): Promise<Application> {
  if (!useMockApi) {
    try {
      return await request<Application>(`/api/v1/ui/applications/${applicationId}`);
    } catch {}
  }
  return {
    id: applicationId,
    name: 'Priya Sharma',
    role: 'Software Engineer',
    status: 'Applied',
    cgpa: '9.1',
    branch: 'CSE',
    score: '90%',
    queuePosition: 19,
    rank: 42,
    update: 'Application state supplied by Team C'
  };
}

export async function fetchPlacementSnapshot(_role: Role): Promise<PlacementSnapshot> {
  if (!useMockApi) {
    try {
      return await request<PlacementSnapshot>('/api/v1/ui/dashboard');
    } catch {}
  }
  await wait();
  return {
    totalStudents: 420,
    eligibleStudents: 286,
    totalApplications: 612,
    shortlistedStudents: 128,
    selectedStudents: 104,
    placedStudents: 96,
    branchBreakdown: [
      { branch: 'CSE', applications: 224, placed: 42 },
      { branch: 'IT', applications: 156, placed: 27 },
      { branch: 'ECE', applications: 132, placed: 18 },
      { branch: 'EEE', applications: 100, placed: 9 }
    ]
  };
}

export type CandidateRanking = {
  rank: number;
  name: string;
  score: string;
  status: string;
  isCurrentUser?: boolean;
  branch?: string;
  cgpa?: string;
  skillMatch?: string;
};

export async function fetchRankings(): Promise<CandidateRanking[]> {

  if (!useMockApi) {
    try {
      return await request<Array<{ rank: number; name: string; score: string; status: string; isCurrentUser?: boolean }>>(
        '/api/v1/ui/rankings'
      );
    } catch {}
  }
  await wait();
  return [
    { rank: 1, name: 'Ananya Rao', score: '96%', status: 'Shortlisted' },
    { rank: 2, name: 'Rahul Menon', score: '94%', status: 'Shortlisted' },
    { rank: 3, name: 'Priya Sharma', score: '92%', status: 'Shortlisted', isCurrentUser: true },
    { rank: 4, name: 'Neha R.', score: '90%', status: 'Shortlisted' },
    { rank: 5, name: 'Aditya S.', score: '88%', status: 'Under review' },
    { rank: 6, name: 'Kavya M.', score: '86%', status: 'Under review' }
  ];
}

export async function updateDrive(driveId: string, changes: Partial<PlacementDrive>): Promise<PlacementDrive> {
  if (!useMockApi) {
    try {
      return await request<PlacementDrive>(`/api/v1/ui/drives/${driveId}`, {
        method: 'PATCH',
        body: JSON.stringify(changes)
      });
    } catch {}
  }
  const drives = await fetchDrives();
  const drive = drives.find((item) => item.id === driveId) ?? drives[0];
  return { ...drive, ...changes };
}

export async function fetchPlacementReport(): Promise<PlacementSnapshot> {
  if (!useMockApi) {
    try {
      return await request<PlacementSnapshot>('/api/v1/ui/reports/placement-performance');
    } catch {}
  }
  return fetchPlacementSnapshot('Faculty_TPO');
}

export async function previewRankings(): Promise<Array<{ rank: number; name: string; score: string; status: string }>> {
  if (!useMockApi) {
    try {
      return await request<Array<{ rank: number; name: string; score: string; status: string }>>(
        '/api/v1/ui/rankings/preview',
        { method: 'POST' }
      );
    } catch {}
  }
  return fetchRankings();
}

export function subscribeToLiveUpdates(
  onUpdate: (message: string) => void,
  onStateChange?: (state: LiveConnectionState) => void
): () => void {
  if (!useMockApi && typeof EventSource !== 'undefined') {
    try {
      const source = new EventSource(`${apiBaseUrl}/api/v1/ui/stream`);
      onStateChange?.('connected');
      source.onmessage = (event) => {
        onStateChange?.('connected');
        onUpdate(event.data);
      };
      source.onerror = () => onStateChange?.('reconnecting');
      return () => source.close();
    } catch {}
  }
  onStateChange?.('connected');
  const timer = window.setInterval(() => {
    onUpdate('Team C Outbox: Master data checkpoint committed; WAL synchronized.');
  }, 12000);
  return () => window.clearInterval(timer);
}
