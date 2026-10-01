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
  assert(typeof student.project_score === 'number', 'project_score must be a number.');
  assert(Array.isArray(student.skill_tags) && student.skill_tags.length > 0, 'skill_tags must contain at least one skill.');
}

export function validateDriveProfile(drive: Drive): void {
  assert(drive && typeof drive === 'object', 'Drive profile is required.');
  assert(typeof drive.drive_id === 'string' && drive.drive_id.length > 0, 'drive_id is required.');
  assert(typeof drive.company === 'string' && drive.company.length > 0, 'company is required.');
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
    validateStudentProfile(student);
    const node = `student:${student.student_id}`;
    this.graph.removeNode(node);
    this.students.set(student.student_id, { ...student, skill_tags: [...student.skill_tags] });
    for (const skill of student.skill_tags) this.graph.addUndirectedEdge(node, `skill:${skill}`);
    this.incrementGraphVersion();
    return { student_id: student.student_id, graph_version: this.graph_version };
  }

  addOrUpdateDrive(drive: Drive): { drive_id: string; graph_version: string } {
    validateDriveProfile(drive);
    const node = `drive:${drive.drive_id}`;
    this.graph.removeNode(node);
    this.drives.set(drive.drive_id, { ...drive, criteria: { ...drive.criteria, required_skill_tags: [...drive.criteria.required_skill_tags] }, skill_weightage: { ...drive.skill_weightage } });
    for (const skill of drive.criteria.required_skill_tags) this.graph.addUndirectedEdge(node, `skill:${skill}`);
    this.incrementGraphVersion();
    return { drive_id: drive.drive_id, graph_version: this.graph_version };
  }

  getStudent(studentId: string): Student | null { return this.students.get(studentId) ?? null; }
  getDrive(driveId: string): Drive | null { return this.drives.get(driveId) ?? null; }
  getStudentSkills(studentId: string): string[] { return this.graph.getNeighbors(`student:${studentId}`).filter((node) => node.startsWith('skill:')).map((node) => node.slice('skill:'.length)); }
  getDriveRequiredSkills(driveId: string): string[] { return this.graph.getNeighbors(`drive:${driveId}`).filter((node) => node.startsWith('skill:')).map((node) => node.slice('skill:'.length)); }
  getGraphSummary(): GraphSummary { return { graph_version: this.graph_version, total_students: this.students.size, total_drives: this.drives.size, representation_type: 'ADJACENCY_LIST' }; }
  getGraph(): GraphObject { return this.graph.toObject(); }
  private incrementGraphVersion(): void { this.graphVersionNumber += 1; }
}
