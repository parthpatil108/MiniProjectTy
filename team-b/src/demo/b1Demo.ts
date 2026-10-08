import { dummyDrives, dummyStudents } from '../data/dummyProfiles';
import { ProfileRegistryService } from '../services/profileRegistryService';
import { compareGraphRepresentations } from '../graph/adjacencyList';

const registry = new ProfileRegistryService();
for (const student of dummyStudents) registry.addOrUpdateStudent(student);
for (const drive of dummyDrives) registry.addOrUpdateDrive(drive);

console.log('Team B B1: Skill/Requirement Graph Demo');
console.log(JSON.stringify(registry.getGraphSummary(), null, 2));
console.log(`S001 -> ${registry.getStudentSkills('S001').join(', ')}`);
console.log(`D001 (TCS) -> ${registry.getDriveRequiredSkills('D001').join(', ')}`);
console.log(JSON.stringify(registry.getGraph(), null, 2));
const graph = registry.getGraph();
const nodes = Object.keys(graph);
const edges = nodes.flatMap((node) => graph[node].filter((neighbor) => node < neighbor).map((neighbor) => [node, neighbor] as const));
console.log('Adjacency representation comparison:', JSON.stringify(compareGraphRepresentations(nodes, edges, edges), null, 2));
