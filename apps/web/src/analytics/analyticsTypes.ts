export type AnalyticsFilters = {
  academicYear: string;
  branch: string;
  company: string;
  drive: string;
  dateRange: string;
};

export type AnalyticsKpis = {
  totalStudents: number;
  applications: number;
  eligible: number;
  shortlisted: number;
  interviews: number;
  selected: number;
  placed: number;
  placementRate: number;
};

export type AnalyticsDataset = {
  filters: { academicYears: string[]; branches: string[]; companies: string[]; drives: string[]; dateRanges: string[] };
  kpis: AnalyticsKpis;
  statusDistribution: Array<{ label: string; value: number; color: string }>;
  applicationTrend: Array<{ label: string; value: number }>;
  placementTrend: Array<{ label: string; value: number }>;
  companySelection: Array<{ label: string; selected: number; applications: number; conversion: number; package?: number }>;
  branchPerformance: Array<{ label: string; applications: number; shortlisted: number; selected: number; rate: number }>;
  drivePerformance: Array<{ label: string; applications: number; eligible: number; shortlisted: number; selected: number; seats: number; conversion: number }>;
  packageDistribution: Array<{ label: string; value: number }>;
  funnel: Array<{ label: string; value: number; conversion: number }>;
};
