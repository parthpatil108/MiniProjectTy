import { AdjacencyList } from '../graph/adjacencyList';
import type { Drive, GraphObject, GraphSummary, Student } from '../types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateStudentProfile(student: Student): void {
  assert(student && typeof student === 'object', 'Student profile is required.');
  assert(typeof student.student_id === 'string' && student.student_id.length > 0, 'student_id is required.');
  assert(typeof student.cgpa === 'number' && student.cgpa >= 0 && student.cgpa <= 10, 'cgpa must be between 0 and 10.');
  assert(Number.isInteger(student.backlogs) && student.backlogs >= 0, 'backlogs must be a non-negative integer.');
  assert(typeof (student.project_score ?? 0) === 'number', 'project_score must be a number.');
  assert(Array.isArray(student.skill_tags) && student.skill_tags.length > 0, 'skill_tags must contain at least one skill.');
}

export function validateDriveProfile(drive: Drive): void {
  assert(drive && typeof drive === 'object', 'Drive profile is required.');
  assert(typeof drive.drive_id === 'string' && drive.drive_id.length > 0, 'drive_id is required.');
  const company = drive.company || (drive as any).company_name;
  assert(typeof company === 'string' && company.length > 0, 'company is required.');
  assert(drive.criteria && typeof drive.criteria === 'object', 'criteria is required.');
  assert(typeof drive.criteria.min_cgpa === 'number', 'criteria.min_cgpa must be a number.');
  assert(Array.isArray(drive.criteria.required_skill_tags) && drive.criteria.required_skill_tags.length > 0, 'criteria.required_skill_tags must contain at least one skill.');
  assert(drive.skill_weightage && typeof drive.skill_weightage === 'object', 'skill_weightage is required.');
}

export class ProfileRegistryService {
  readonly students = new Map<string, Student>();
  readonly drives = new Map<string, Drive>();
  private readonly graph = new AdjacencyList();
  private graphVersionNumber = 0;

  get graph_version(): string { return `graph-v${this.graphVersionNumber}`; }

  addOrUpdateStudent(student: Student): { student_id: string; graph_version: string } {
    const normalizedStudent: Student = {
      ...student,
      project_score: student.project_score !== undefined ? Number(student.project_score) : 0,
      skill_tags: [...student.skill_tags]
    };
    validateStudentProfile(normalizedStudent);
    const node = `student:${normalizedStudent.student_id}`;
    this.graph.removeNode(node);
    this.students.set(normalizedStudent.student_id, normalizedStudent);
    for (const skill of normalizedStudent.skill_tags) this.graph.addUndirectedEdge(node, `skill:${skill}`);
    this.incrementGraphVersion();
    return { student_id: normalizedStudent.student_id, graph_version: this.graph_version };
  }

  addOrUpdateDrive(drive: Drive): { drive_id: string; graph_version: string } {
    const company = drive.company || (drive as any).company_name || 'Unknown Company';
    const skill_weightage = drive.skill_weightage || (drive.criteria?.required_skill_tags ? Object.fromEntries(drive.criteria.required_skill_tags.map((s: string) => [s, 1.0])) : {});
    const normalizedDrive: Drive = {
      ...drive,
      company,
      skill_weightage,
      criteria: {
        ...drive.criteria,
        required_skill_tags: [...(drive.criteria?.required_skill_tags || [])]
      }
    };
    validateDriveProfile(normalizedDrive);
    const node = `drive:${normalizedDrive.drive_id}`;
    this.graph.removeNode(node);
    this.drives.set(normalizedDrive.drive_id, normalizedDrive);
    for (const skill of normalizedDrive.criteria.required_skill_tags) this.graph.addUndirectedEdge(node, `skill:${skill}`);
    this.incrementGraphVersion();
    return { drive_id: normalizedDrive.drive_id, graph_version: this.graph_version };
  }

  getStudent(studentId: string): Student | null { return this.students.get(studentId) ?? null; }
  getDrive(driveId: string): Drive | null { return this.drives.get(driveId) ?? null; }
  getStudentSkills(studentId: string): string[] { return this.graph.getNeighbors(`student:${studentId}`).filter((node) => node.startsWith('skill:')).map((node) => node.slice('skill:'.length)); }
  getDriveRequiredSkills(driveId: string): string[] { return this.graph.getNeighbors(`drive:${driveId}`).filter((node) => node.startsWith('skill:')).map((node) => node.slice('skill:'.length)); }
  getGraphSummary(): GraphSummary { return { graph_version: this.graph_version, total_students: this.students.size, total_drives: this.drives.size, representation_type: 'ADJACENCY_LIST' }; }
  getGraph(): GraphObject { return this.graph.toObject(); }
  private incrementGraphVersion(): void { this.graphVersionNumber += 1; }
}
