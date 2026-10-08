import { Drive, Student } from '../types';

export class AdjacencyMatrixGraph {
  private studentIndices: Map<string, number> = new Map();
  private driveIndices: Map<string, number> = new Map();
  private students: Student[] = [];
  private drives: Drive[] = [];
  
  // matrix[studentIndex][driveIndex] = score/weight
  private matrix: (number | null)[][] = [];

  constructor() {}

  public get version(): string {
    return `matrix-v${this.students.length + this.drives.length}`;
  }

  public addStudent(student: Student): void {
    if (!this.studentIndices.has(student.student_id)) {
      this.studentIndices.set(student.student_id, this.students.length);
      this.students.push(student);
      this.matrix.push(new Array(this.drives.length).fill(null));
    } else {
      this.students[this.studentIndices.get(student.student_id)!] = student;
    }
  }

  public addDrive(drive: Drive): void {
    if (!this.driveIndices.has(drive.drive_id)) {
      this.driveIndices.set(drive.drive_id, this.drives.length);
      this.drives.push(drive);
      for (const row of this.matrix) {
        row.push(null);
      }
    } else {
      this.drives[this.driveIndices.get(drive.drive_id)!] = drive;
    }
  }

  public getStudent(id: string): Student | undefined {
    const idx = this.studentIndices.get(id);
    return idx !== undefined ? this.students[idx] : undefined;
  }

  public getDrive(id: string): Drive | undefined {
    const idx = this.driveIndices.get(id);
    return idx !== undefined ? this.drives[idx] : undefined;
  }

  public getSummary() {
    return {
      graph_version: this.version,
      total_students: this.students.length,
      total_drives: this.drives.length,
      representation_type: 'ADJACENCY_MATRIX' as const
    };
  }
}
