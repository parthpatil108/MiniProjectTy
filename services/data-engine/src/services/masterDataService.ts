import { v4 as uuidv4 } from 'uuid';
import { TransactionManager } from '../txn/transactionManager.js';
import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';
import { AppError } from '../api/middleware/errorEnvelope.js';
import { OutboxService } from './outboxService.js';

export interface StudentInput {
  name: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  attendance: number;
  skill_tags: string[];
  project_score?: number;
}

export interface DriveCriteria {
  min_cgpa: number;
  max_backlogs: number;
  allowed_branches: string[];
  min_attendance: number;
  required_skill_tags: string[];
}

export interface DriveInput {
  drive_id?: string;
  company: string;
  criteria: DriveCriteria;
  seats: number;
  package: string;
  state?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
}

export interface DriveUpdateInput {
  expectedVersion: number;
  criteria?: DriveCriteria;
  seats?: number;
  state?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
}

async function syncStudentToTeamB(student: any, correlationId?: string): Promise<void> {
  const teamBUrl = process.env.TEAM_B_URL || 'http://localhost:3002';
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';
  try {
    const res = await fetch(`${teamBUrl}/internal/v1/profiles/students/${student.student_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': internalSecret,
        ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
      },
      body: JSON.stringify(student),
    });
    if (!res.ok) {
      new OutboxService().recordEvent('SYNC_STUDENT_PROFILE', student.student_id, student, 'FAILED');
    }
  } catch (err: any) {
    new OutboxService().recordEvent('SYNC_STUDENT_PROFILE', student.student_id, student, 'FAILED');
  }
}

async function syncDriveToTeamB(drive: any, correlationId?: string): Promise<void> {
  const teamBUrl = process.env.TEAM_B_URL || 'http://localhost:3002';
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';
  try {
    const res = await fetch(`${teamBUrl}/internal/v1/profiles/drives/${drive.drive_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': internalSecret,
        ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
      },
      body: JSON.stringify(drive),
    });
    if (!res.ok) {
      new OutboxService().recordEvent('SYNC_DRIVE_PROFILE', drive.drive_id, drive, 'FAILED');
    }
  } catch (err: any) {
    new OutboxService().recordEvent('SYNC_DRIVE_PROFILE', drive.drive_id, drive, 'FAILED');
  }
}


export class MasterDataService {
  private customTxnManager?: TransactionManager;
  private customStorageManager?: StorageManager;

  constructor(txnManager?: TransactionManager, storageManager?: StorageManager) {

    this.customTxnManager = txnManager;
    this.customStorageManager = storageManager;
  }

  private getTxnManager(): TransactionManager {
    return this.customTxnManager || TransactionManager.getInstance();
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public async createStudent(input: StudentInput): Promise<{ student_id: string; version: number; created_at: string }> {
    if (!input.name || !input.branch || input.cgpa === undefined || input.backlogs === undefined || input.attendance === undefined || !input.skill_tags) {
      const err: AppError = new Error('Missing required student fields (name, branch, cgpa, backlogs, attendance, skill_tags)');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const student_id = `STU-${uuidv4().substring(0, 8)}`;
    const txnManager = this.getTxnManager();

    const txn = txnManager.beginTransaction();
    try {
      const record = await txnManager.write<BaseRecord>(
        'students',
        student_id,
        'INSERT',
        {
          student_id,
          name: input.name,
          branch: input.branch,
          cgpa: Number(input.cgpa),
          backlogs: Number(input.backlogs),
          attendance: Number(input.attendance),
          skill_tags: input.skill_tags,
          project_score: input.project_score !== undefined ? Number(input.project_score) : 0,
        },
        undefined,
        txn
      );

      await txnManager.commit(txn);

      syncStudentToTeamB({
        student_id,
        name: input.name,
        branch: input.branch,
        cgpa: Number(input.cgpa),
        backlogs: Number(input.backlogs),
        attendance: Number(input.attendance),
        skill_tags: input.skill_tags,
        project_score: input.project_score !== undefined ? Number(input.project_score) : 0,
      });

      return {
        student_id: (record as any)?.student_id || student_id,
        version: record?._version || 1,
        created_at: record?._createdAt || new Date().toISOString(),
      };
    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }

  public async listStudents(): Promise<any[]> {
    const result = this.getStorageManager().query('students', {});
    return result.records.map((r) => ({
      student_id: r.student_id,
      name: r.name,
      branch: r.branch,
      cgpa: r.cgpa,
      backlogs: r.backlogs,
      attendance: r.attendance,
      skill_tags: r.skill_tags,
      version: r._version || 1,
      created_at: r._createdAt,
    }));
  }

  public async createDrive(input: DriveInput): Promise<any> {
    if (!input.company || !input.criteria || input.seats === undefined || !input.package) {
      const err: AppError = new Error('Missing required drive fields (company, criteria, seats, package)');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const drive_id = input.drive_id || uuidv4();
    const txnManager = this.getTxnManager();
    const txn = txnManager.beginTransaction();

    try {
      const record = await txnManager.write<BaseRecord>(
        'drives',
        drive_id,
        'INSERT',
        {
          drive_id,
          company: input.company,
          criteria: input.criteria,
          seats: Number(input.seats),
          package: input.package,
          state: input.state || 'OPEN',
        },
        undefined,
        txn
      );

      await txnManager.commit(txn);

      syncDriveToTeamB({
        drive_id,
        company: input.company,
        criteria: input.criteria,
        seats: Number(input.seats),
        package: input.package,
        state: input.state || 'OPEN',
      });

      return {
        drive_id: (record as any)?.drive_id || drive_id,
        company: (record as any)?.company,
        criteria: (record as any)?.criteria,
        seats: (record as any)?.seats,
        package: (record as any)?.package,
        state: (record as any)?.state,
        version: record?._version || 1,
      };
    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }

  public async listDrives(stateFilter?: string): Promise<any[]> {
    const filter = stateFilter ? { state: stateFilter } : undefined;
    const result = this.getStorageManager().query('drives', { filter });
    return result.records.map((r) => ({
      drive_id: r.drive_id,
      company: r.company,
      criteria: r.criteria,
      seats: r.seats,
      package: r.package,
      state: r.state,
      version: r._version || 1,
    }));
  }

  public async getDriveCriteria(driveId: string): Promise<any> {
    const drive = this.getStorageManager().getById('drives', driveId);
    if (!drive) {
      const err: AppError = new Error(`Drive with ID ${driveId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    return {
      drive_id: drive.drive_id,
      company: drive.company,
      criteria: drive.criteria,
      seats: drive.seats,
      package: drive.package,
      state: drive.state,
      version: drive._version || 1,
    };
  }

  public async updateDrive(driveId: string, input: DriveUpdateInput): Promise<any> {
    if (input.expectedVersion === undefined || input.expectedVersion === null) {
      const err: AppError = new Error('expectedVersion is required for drive updates');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const txnManager = this.getTxnManager();
    const txn = txnManager.beginTransaction();

    try {
      const patch: any = {};
      if (input.criteria !== undefined) patch.criteria = input.criteria;
      if (input.seats !== undefined) patch.seats = Number(input.seats);
      if (input.state !== undefined) patch.state = input.state;

      const record = await txnManager.write<BaseRecord>(
        'drives',
        driveId,
        'UPDATE',
        patch,
        input.expectedVersion,
        txn
      );

      await txnManager.commit(txn);

      const updatedRecord = this.getStorageManager().getById('drives', driveId);
      if (updatedRecord) {
        syncDriveToTeamB(updatedRecord);
      }

      return {
        drive_id: (record as any)?.drive_id || driveId,
        company: (record as any)?.company,
        criteria: (record as any)?.criteria,
        seats: (record as any)?.seats,
        package: (record as any)?.package,
        state: (record as any)?.state,
        version: record?._version,
      };
    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }
}
