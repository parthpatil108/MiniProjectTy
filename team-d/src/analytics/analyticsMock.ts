import type { AnalyticsDataset, AnalyticsFilters } from './analyticsTypes';

export const defaultAnalyticsFilters: AnalyticsFilters = { academicYear: 'AY 2026–27', branch: 'All branches', company: 'All companies', drive: 'All drives', dateRange: 'Academic year' };

export const analyticsMock: AnalyticsDataset = {
  filters: {
    academicYears: ['AY 2026–27', 'AY 2025–26'],
    branches: ['All branches', 'CSE', 'IT', 'ECE', 'EEE'],
    companies: ['All companies', 'Google', 'Amazon', 'Deloitte', 'Infosys'],
    drives: ['All drives', 'Google SDE', 'Amazon ML', 'Deloitte Analyst', 'Infosys Systems'],
    dateRanges: ['Academic year', 'Last 6 months', 'Last 30 days']
  },
  kpis: { totalStudents: 420, applications: 612, eligible: 286, shortlisted: 128, interviews: 112, selected: 104, placed: 96, placementRate: 22.9 },
  statusDistribution: [
    { label: 'Applied', value: 146, color: '#6c8791' },
    { label: 'Screening', value: 154, color: '#277b88' },
    { label: 'Shortlisted', value: 128, color: '#ef7f5d' },
    { label: 'Interview', value: 80, color: '#d59b3f' },
    { label: 'Selected', value: 58, color: '#2d8564' },
    { label: 'Rejected / other', value: 46, color: '#c9d2cf' }
  ],
  applicationTrend: [
    { label: 'Apr', value: 44 }, { label: 'May', value: 72 }, { label: 'Jun', value: 91 }, { label: 'Jul', value: 126 }, { label: 'Aug', value: 168 }, { label: 'Sep', value: 111 }
  ],
  placementTrend: [
    { label: 'Apr', value: 4 }, { label: 'May', value: 9 }, { label: 'Jun', value: 16 }, { label: 'Jul', value: 24 }, { label: 'Aug', value: 31 }, { label: 'Sep', value: 12 }
  ],
  companySelection: [
    { label: 'Google', selected: 28, applications: 74, conversion: 37.8, package: 24 },
    { label: 'Amazon', selected: 22, applications: 68, conversion: 32.4, package: 18 },
    { label: 'Deloitte', selected: 18, applications: 92, conversion: 19.6, package: 10 },
    { label: 'Infosys', selected: 15, applications: 116, conversion: 12.9, package: 8 },
    { label: 'Accenture', selected: 12, applications: 83, conversion: 14.5, package: 9 },
    { label: 'Wipro', selected: 9, applications: 71, conversion: 12.7, package: 7 }
  ],
  branchPerformance: [
    { label: 'CSE', applications: 224, shortlisted: 62, selected: 42, rate: 18.8 },
    { label: 'IT', applications: 156, shortlisted: 38, selected: 27, rate: 17.3 },
    { label: 'ECE', applications: 132, shortlisted: 18, selected: 18, rate: 13.6 },
    { label: 'EEE', applications: 100, shortlisted: 10, selected: 9, rate: 9.0 }
  ],
  drivePerformance: [
    { label: 'Google SDE', applications: 74, eligible: 52, shortlisted: 34, selected: 28, seats: 18, conversion: 37.8 },
    { label: 'Amazon ML', applications: 68, eligible: 48, shortlisted: 27, selected: 22, seats: 12, conversion: 32.4 },
    { label: 'Deloitte Analyst', applications: 92, eligible: 64, shortlisted: 31, selected: 18, seats: 24, conversion: 19.6 },
    { label: 'Infosys Systems', applications: 116, eligible: 72, shortlisted: 36, selected: 15, seats: 30, conversion: 12.9 }
  ],
  packageDistribution: [{ label: '< ₹5 LPA', value: 18 }, { label: '₹5–10 LPA', value: 42 }, { label: '₹10–15 LPA', value: 22 }, { label: '₹15–20 LPA', value: 12 }, { label: '₹20+ LPA', value: 6 }],
  funnel: [{ label: 'Applications', value: 612, conversion: 100 }, { label: 'Eligibility passed', value: 286, conversion: 46.7 }, { label: 'Shortlisted', value: 128, conversion: 44.8 }, { label: 'Interview', value: 112, conversion: 87.5 }, { label: 'Selected', value: 104, conversion: 92.9 }, { label: 'Placed', value: 96, conversion: 92.3 }]
};
