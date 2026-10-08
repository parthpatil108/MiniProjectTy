import { StorageManager } from '../storage/storageManager.js';

export class ReportService {
  private customStorageManager?: StorageManager;

  constructor(storageManager?: StorageManager) {
    this.customStorageManager = storageManager;
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public getPlacementPerformanceReport(): any {
    const storage = this.getStorageManager();
    const apps = storage.query('applications', {}).records;
    const students = storage.query('students', {}).records;

    const studentBranchMap = new Map<string, string>();
    for (const s of students) {
      if (s.student_id && s.branch) {
        studentBranchMap.set(s.student_id, s.branch);
      }
    }

    let totalApplications = apps.length;
    let totalOffers = 0;
    const departmentBreakdown: Record<string, { applications: number; offers: number }> = {};

    for (const app of apps) {
      const isOffer = app.state === 'OFFER_ISSUED' || app.state === 'SELECTED';
      if (isOffer) {
        totalOffers++;
      }

      const branch = studentBranchMap.get(app.student_id) || 'UNKNOWN';
      if (!departmentBreakdown[branch]) {
        departmentBreakdown[branch] = { applications: 0, offers: 0 };
      }
      departmentBreakdown[branch].applications++;
      if (isOffer) {
        departmentBreakdown[branch].offers++;
      }
    }

    return {
      total_applications: totalApplications,
      total_offers: totalOffers,
      department_breakdown: departmentBreakdown,
    };
  }
}
