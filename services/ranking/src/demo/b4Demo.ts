import type { HistoricalPlacementRecord } from '../types';
import { AnalyticsService } from '../services/analyticsService';
import { benchmarkAnalytics } from '../services/benchmarkService';
const records: HistoricalPlacementRecord[] = [
  { student_id: 'S001', department: 'CSE', batch: '2026', company: 'Acme', stage: 'Placed', package_lpa: 12 },
  { student_id: 'S002', department: 'CSE', batch: '2026', company: 'Acme', stage: 'Applied' },
  { student_id: 'S003', department: 'ECE', batch: '2026', company: 'Beta', stage: 'Placed', package_lpa: 5 },
];
console.log('B4 analytics:', JSON.stringify(new AnalyticsService(records).analyse({}), null, 2));
console.log('Separate aggregation benchmark:', JSON.stringify(benchmarkAnalytics(20_000), null, 2));
