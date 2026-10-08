import assert from 'node:assert/strict';
import test from 'node:test';
import { dummyDrives, dummyStudents } from '../src/data/dummyProfiles';
import { ProfileRegistryService } from '../src/services/profileRegistryService';
import { compareGraphRepresentations } from '../src/graph/adjacencyList';

test('B1 builds a deterministic adjacency-list graph from dummy profiles', () => {
  const registry = new ProfileRegistryService();
  for (const student of dummyStudents) registry.addOrUpdateStudent(student);
  for (const drive of dummyDrives) registry.addOrUpdateDrive(drive);
  assert.deepEqual(registry.getGraphSummary(), { graph_version: 'graph-v8', total_students: 5, total_drives: 3, representation_type: 'ADJACENCY_LIST' });
  assert.deepEqual(registry.getStudentSkills('S001'), ['Java', 'React', 'SQL']);
  assert.deepEqual(registry.getDriveRequiredSkills('D001'), ['Java', 'React', 'SQL']);
  assert.deepEqual(registry.getGraph()['skill:Java'], ['drive:D001', 'student:S001', 'student:S003', 'student:S004']);
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
