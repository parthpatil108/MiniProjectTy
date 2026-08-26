const test = require('node:test');
const assert = require('node:assert/strict');
const { dummyStudents, dummyDrives } = require('../src/data/dummyProfiles');
const { ProfileRegistryService } = require('../src/services/profileRegistryService');

test('B1 builds a deterministic adjacency-list graph from dummy profiles', () => {
  const registry = new ProfileRegistryService();

  for (const student of dummyStudents) {
    registry.addOrUpdateStudent(student);
  }
  for (const drive of dummyDrives) {
    registry.addOrUpdateDrive(drive);
  }

  assert.deepEqual(registry.getGraphSummary(), {
    graph_version: 'graph-v8',
    total_students: 5,
    total_drives: 3,
    representation_type: 'ADJACENCY_LIST'
  });
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
