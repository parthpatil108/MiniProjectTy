import assert from 'node:assert/strict';
import test from 'node:test';
import { dummyDrives, dummyStudents } from '../src/data/dummyProfiles';
import { ProfileRegistryService } from '../src/services/profileRegistryService';
import { compareGraphRepresentations } from '../src/graph/adjacencyList';

test('B1 builds a deterministic adjacency-list graph from dummy profiles', () => {
  const registry = new ProfileRegistryService();
  for (const student of dummyStudents) registry.addOrUpdateStudent(student);
  for (const drive of dummyDrives) registry.addOrUpdateDrive(drive);
  assert.deepEqual(registry.getGraphSummary(), { graph_version: 'graph-v8', total_students: 5, total_drives: 3, representation_type: 'ADJACENCY_LIST', coverage_summary: { total_students: 5, total_drives: 3, total_student_skill_edges: 15, total_drive_skill_edges: 7, covered_required_skill_pairs: 7, uncovered_required_skill_pairs: 0, coverage_percentage: 100, uncovered_requirements: [] } });
  assert.deepEqual(registry.getStudentSkills('S001'), ['Java', 'React', 'SQL']);
  assert.deepEqual(registry.getDriveRequiredSkills('D001'), ['Java', 'React', 'SQL']);
  assert.deepEqual(registry.getGraph()['skill:Java'], ['drive:D001', 'student:S001', 'student:S003', 'student:S004']);
});

test('B1 reports fully covered, partially covered, and empty requirement coverage', () => {
  const student = (student_id: string, skill_tags: string[]) => ({ student_id, name: student_id, branch: 'CSE', cgpa: 8, backlogs: 0, attendance: 90, project_score: 80, skill_tags });
  const drive = (required_skill_tags: string[]) => ({ drive_id: 'D', company: 'Example', criteria: { min_cgpa: 6, max_backlogs: 0, allowed_branches: ['CSE'], min_attendance: 75, required_skill_tags }, skill_weightage: Object.fromEntries(required_skill_tags.map((skill) => [skill, 100 / required_skill_tags.length])), seats: 1, package: '0', state: 'OPEN', version: 1 });

  const fullyCovered = new ProfileRegistryService();
  fullyCovered.addOrUpdateStudent(student('S1', ['Java'])); fullyCovered.addOrUpdateStudent(student('S2', ['SQL']));
  fullyCovered.addOrUpdateDrive(drive(['Java', 'SQL']));
  assert.deepEqual(fullyCovered.getCoverageSummary(), { total_students: 2, total_drives: 1, total_student_skill_edges: 2, total_drive_skill_edges: 2, covered_required_skill_pairs: 2, uncovered_required_skill_pairs: 0, coverage_percentage: 100, uncovered_requirements: [] });

  const partiallyCovered = new ProfileRegistryService();
  partiallyCovered.addOrUpdateStudent(student('S1', ['Java'])); partiallyCovered.addOrUpdateDrive(drive(['Java', 'React']));
  assert.deepEqual(partiallyCovered.getCoverageSummary(), { total_students: 1, total_drives: 1, total_student_skill_edges: 1, total_drive_skill_edges: 2, covered_required_skill_pairs: 1, uncovered_required_skill_pairs: 1, coverage_percentage: 50, uncovered_requirements: [{ drive_id: 'D', skill: 'React' }] });

  const empty = new ProfileRegistryService();
  assert.deepEqual(empty.getCoverageSummary(), { total_students: 0, total_drives: 0, total_student_skill_edges: 0, total_drive_skill_edges: 0, covered_required_skill_pairs: 0, uncovered_required_skill_pairs: 0, coverage_percentage: 0, uncovered_requirements: [] });
  empty.addOrUpdateDrive(drive(['Java']));
  assert.equal(empty.getCoverageSummary().coverage_percentage, 0);
  assert.deepEqual(empty.getCoverageSummary().uncovered_requirements, [{ drive_id: 'D', skill: 'Java' }]);
});

test('B1 updates a student profile and rebuilds that student skill relationship', () => {
  const registry = new ProfileRegistryService();
  registry.addOrUpdateStudent(dummyStudents[0]);
  registry.addOrUpdateStudent({ ...dummyStudents[0], skill_tags: ['Java', 'Node.js'] });
  assert.equal(registry.graph_version, 'graph-v2');
  assert.deepEqual(registry.getStudentSkills('S001'), ['Java', 'Node.js']);
  assert.deepEqual(registry.getGraph()['skill:React'], []);
});

test('B1 compares adjacency-list and matrix lookup behavior and storage shape', () => {
  const result = compareGraphRepresentations(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']], [['a', 'b'], ['a', 'c']]);
  assert.equal(result.node_count, 3);
  assert.equal(result.edge_count, 2);
  assert.equal(result.adjacency_list.successful_lookups, 1);
  assert.equal(result.adjacency_matrix.successful_lookups, 1);
  assert.equal(result.adjacency_list.stored_neighbor_references, 4);
  assert.equal(result.adjacency_matrix.allocated_boolean_cells, 9);
});
