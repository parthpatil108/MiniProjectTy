import type { Drive, Student } from '../types';

export const dummyStudents: Student[] = [
  { student_id: 'S001', name: 'Aarav', branch: 'CSE', cgpa: 8.7, backlogs: 0, attendance: 90, project_score: 88, skill_tags: ['Java', 'SQL', 'React'] },
  { student_id: 'S002', name: 'Diya', branch: 'CSE', cgpa: 8.2, backlogs: 0, attendance: 88, project_score: 82, skill_tags: ['Python', 'SQL'] },
  { student_id: 'S003', name: 'Kabir', branch: 'IT', cgpa: 7.9, backlogs: 1, attendance: 85, project_score: 79, skill_tags: ['Java', 'Node.js', 'SQL', 'React'] },
  { student_id: 'S004', name: 'Meera', branch: 'CSE', cgpa: 9.1, backlogs: 0, attendance: 94, project_score: 92, skill_tags: ['Java', 'React', 'JavaScript', 'SQL'] },
  { student_id: 'S005', name: 'Rohan', branch: 'ECE', cgpa: 7.5, backlogs: 0, attendance: 81, project_score: 75, skill_tags: ['Python', 'JavaScript'] }
];

export const dummyDrives: Drive[] = [
  { drive_id: 'D001', company: 'TCS', criteria: { min_cgpa: 7, max_backlogs: 1, allowed_branches: ['CSE', 'IT', 'ECE'], min_attendance: 75, required_skill_tags: ['Java', 'SQL', 'React'] }, skill_weightage: { Java: 40, SQL: 30, React: 30 }, seats: 5, package: '7 LPA', state: 'OPEN', version: 1 },
  { drive_id: 'D002', company: 'Infosys', criteria: { min_cgpa: 7.5, max_backlogs: 0, allowed_branches: ['CSE', 'IT'], min_attendance: 75, required_skill_tags: ['Python', 'SQL'] }, skill_weightage: { Python: 50, SQL: 50 }, seats: 3, package: '6 LPA', state: 'OPEN', version: 1 },
  { drive_id: 'D003', company: 'Wipro', criteria: { min_cgpa: 7, max_backlogs: 1, allowed_branches: ['CSE', 'IT', 'ECE'], min_attendance: 70, required_skill_tags: ['JavaScript', 'React'] }, skill_weightage: { JavaScript: 50, React: 50 }, seats: 2, package: '5.5 LPA', state: 'OPEN', version: 1 }
];
