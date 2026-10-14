import { dummyDrives, dummyStudents } from '../data/dummyProfiles';
import { ProfileRegistryService } from '../services/profileRegistryService';

const registry = new ProfileRegistryService();
for (const student of dummyStudents) registry.addOrUpdateStudent(student);
for (const drive of dummyDrives) registry.addOrUpdateDrive(drive);

console.log('Team B B1: Skill/Requirement Graph Demo');
console.log(JSON.stringify(registry.getGraphSummary(), null, 2));
console.log(`S001 -> ${registry.getStudentSkills('S001').join(', ')}`);
console.log(`D001 (TCS) -> ${registry.getDriveRequiredSkills('D001').join(', ')}`);
console.log(JSON.stringify(registry.getGraph(), null, 2));
