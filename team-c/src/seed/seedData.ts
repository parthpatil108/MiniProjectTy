import { StorageManager } from '../storage/storageManager.js';

export function seedDatabase(storageManager?: StorageManager): { studentsCount: number; drivesCount: number } {
  const storage = storageManager || StorageManager.getInstance();

  const students = [
    { student_id: 'STU-1001', name: 'Rahul Sharma', branch: 'CSE', cgpa: 8.5, backlogs: 0, attendance: 92.5, skill_tags: ['Node.js', 'TypeScript'] },
    { student_id: 'STU-1002', name: 'Priya Patel', branch: 'CSE', cgpa: 9.1, backlogs: 0, attendance: 95.0, skill_tags: ['Java', 'Algorithms'] },
    { student_id: 'STU-1003', name: 'Amit Kumar', branch: 'ECE', cgpa: 7.2, backlogs: 1, attendance: 80.0, skill_tags: ['C++', 'Embedded'] },
    { student_id: 'STU-1004', name: 'Neha Singh', branch: 'IT', cgpa: 8.8, backlogs: 0, attendance: 91.0, skill_tags: ['Python', 'SQL'] },
    { student_id: 'STU-1005', name: 'Rohan Gupta', branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 76.0, skill_tags: ['JavaScript', 'HTML'] },
    { student_id: 'STU-1006', name: 'Sneha Reddy', branch: 'IT', cgpa: 9.4, backlogs: 0, attendance: 98.0, skill_tags: ['TypeScript', 'React'] },
    { student_id: 'STU-1007', name: 'Vikas Verma', branch: 'ECE', cgpa: 7.8, backlogs: 0, attendance: 85.0, skill_tags: ['Python', 'C++'] },
    { student_id: 'STU-1008', name: 'Ananya Roy', branch: 'CSE', cgpa: 8.2, backlogs: 0, attendance: 89.0, skill_tags: ['Node.js', 'Docker'] },
    { student_id: 'STU-1009', name: 'Karan Joshi', branch: 'MECH', cgpa: 6.5, backlogs: 3, attendance: 72.0, skill_tags: ['AutoCAD', 'SolidWorks'] },
    { student_id: 'STU-1010', name: 'Divya Nair', branch: 'IT', cgpa: 8.9, backlogs: 0, attendance: 94.0, skill_tags: ['Java', 'Spring'] },
    { student_id: 'STU-1011', name: 'Siddharth Rao', branch: 'CSE', cgpa: 7.9, backlogs: 0, attendance: 87.0, skill_tags: ['Python', 'Go'] },
    { student_id: 'STU-1012', name: 'Pooja Agarwal', branch: 'ECE', cgpa: 8.1, backlogs: 0, attendance: 88.0, skill_tags: ['Matlab', 'C++'] },
    { student_id: 'STU-1013', name: 'Aditya Mehta', branch: 'CSE', cgpa: 9.6, backlogs: 0, attendance: 99.0, skill_tags: ['Algorithms', 'Rust'] },
    { student_id: 'STU-1014', name: 'Kavya Desai', branch: 'IT', cgpa: 7.4, backlogs: 1, attendance: 82.0, skill_tags: ['PHP', 'MySQL'] },
    { student_id: 'STU-1015', name: 'Manish Pandey', branch: 'CIVIL', cgpa: 6.9, backlogs: 0, attendance: 79.0, skill_tags: ['StaadPro', 'Excel'] },
    { student_id: 'STU-1016', name: 'Ritu Sharma', branch: 'CSE', cgpa: 8.7, backlogs: 0, attendance: 93.0, skill_tags: ['Node.js', 'AWS'] },
    { student_id: 'STU-1017', name: 'Gaurav Bhatia', branch: 'ECE', cgpa: 7.0, backlogs: 1, attendance: 78.0, skill_tags: ['Python', 'Linux'] },
    { student_id: 'STU-1018', name: 'Isha Saxena', branch: 'IT', cgpa: 8.4, backlogs: 0, attendance: 90.0, skill_tags: ['Java', 'Kotlin'] },
    { student_id: 'STU-1019', name: 'Deepak Chaudhary', branch: 'CSE', cgpa: 9.0, backlogs: 0, attendance: 96.0, skill_tags: ['TypeScript', 'Node.js'] },
    { student_id: 'STU-1020', name: 'Shweta Tiwari', branch: 'ECE', cgpa: 7.6, backlogs: 0, attendance: 84.0, skill_tags: ['VLSI', 'Verilog'] },
  ];

  const drives = [
    {
      drive_id: '550e8400-e29b-41d4-a716-446655440001',
      company: 'TechCorp Inc.',
      criteria: { min_cgpa: 7.5, max_backlogs: 0, allowed_branches: ['CSE', 'IT', 'ECE'], min_attendance: 75.0, required_skill_tags: ['TypeScript', 'Node.js'] },
      seats: 5,
      package: '12 LPA',
      state: 'OPEN',
    },
    {
      drive_id: '550e8400-e29b-41d4-a716-446655440002',
      company: 'InnovateX Labs',
      criteria: { min_cgpa: 8.5, max_backlogs: 0, allowed_branches: ['CSE', 'IT'], min_attendance: 85.0, required_skill_tags: ['Algorithms'] },
      seats: 2,
      package: '20 LPA',
      state: 'OPEN',
    },
    {
      drive_id: '550e8400-e29b-41d4-a716-446655440003',
      company: 'DataScale Systems',
      criteria: { min_cgpa: 7.0, max_backlogs: 1, allowed_branches: ['CSE', 'IT', 'ECE'], min_attendance: 70.0, required_skill_tags: ['Python', 'SQL'] },
      seats: 10,
      package: '8 LPA',
      state: 'OPEN',
    },
    {
      drive_id: '550e8400-e29b-41d4-a716-446655440004',
      company: 'CoreElectronics Ltd',
      criteria: { min_cgpa: 7.5, max_backlogs: 0, allowed_branches: ['ECE'], min_attendance: 80.0, required_skill_tags: ['C++'] },
      seats: 1,
      package: '10 LPA',
      state: 'OPEN',
    },
    {
      drive_id: '550e8400-e29b-41d4-a716-446655440005',
      company: 'Draft Ventures',
      criteria: { min_cgpa: 6.0, max_backlogs: 2, allowed_branches: ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL'], min_attendance: 65.0, required_skill_tags: [] },
      seats: 15,
      package: '5 LPA',
      state: 'DRAFT',
    },
  ];

  for (const s of students) {
    storage.insert('students', s);
  }

  for (const d of drives) {
    storage.insert('drives', d);
  }

  storage.saveAllTables();
  return { studentsCount: students.length, drivesCount: drives.length };
}

if (process.argv[1] && process.argv[1].includes('seedData')) {
  const result = seedDatabase();
  console.log(`Seeded ${result.studentsCount} students and ${result.drivesCount} drives successfully.`);
}
