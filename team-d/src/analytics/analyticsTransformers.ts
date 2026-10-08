import type { AnalyticsDataset, AnalyticsFilters } from './analyticsTypes';

export function filterAnalytics(dataset: AnalyticsDataset, filters: AnalyticsFilters): AnalyticsDataset {
  const company = filters.company === 'All companies' ? null : filters.company;
  const branch = filters.branch === 'All branches' ? null : filters.branch;
  const companyData = company ? dataset.companySelection.filter((item) => item.label === company) : dataset.companySelection;
  const branchData = branch ? dataset.branchPerformance.filter((item) => item.label === branch) : dataset.branchPerformance;
  const scale = filters.dateRange === 'Last 30 days' ? 0.32 : filters.dateRange === 'Last 6 months' ? 0.78 : 1;
  const applications = Math.round(dataset.kpis.applications * scale * (branch ? 0.36 : 1) * (company ? 0.22 : 1));
  const selected = Math.round(dataset.kpis.selected * scale * (branch ? 0.36 : 1) * (company ? 0.22 : 1));
  return {
    ...dataset,
    kpis: { ...dataset.kpis, applications, selected, placed: Math.round(dataset.kpis.placed * scale * (branch ? 0.36 : 1) * (company ? 0.22 : 1)), placementRate: applications ? Number((selected / applications * 100).toFixed(1)) : 0 },
    companySelection: companyData,
    branchPerformance: branchData,
    applicationTrend: dataset.applicationTrend.map((item) => ({ ...item, value: Math.round(item.value * scale * (branch ? 0.36 : 1)) })),
    placementTrend: dataset.placementTrend.map((item) => ({ ...item, value: Math.round(item.value * scale * (branch ? 0.36 : 1)) }))
  };
}

export function analyticsInsights(dataset: AnalyticsDataset): string[] {
  const topBranch = [...dataset.branchPerformance].sort((a, b) => b.selected - a.selected)[0];
  const topCompany = [...dataset.companySelection].sort((a, b) => b.selected - a.selected)[0];
  const peakPeriod = [...dataset.applicationTrend].sort((a, b) => b.value - a.value)[0];
  return [`${topBranch?.label ?? 'No branch'} has the highest selection count (${topBranch?.selected ?? 0}).`, `${topCompany?.label ?? 'No company'} leads recruiter selection with ${topCompany?.selected ?? 0} students.`, `${peakPeriod?.label ?? 'This period'} is the peak application period with ${peakPeriod?.value ?? 0} applications.`];
}
