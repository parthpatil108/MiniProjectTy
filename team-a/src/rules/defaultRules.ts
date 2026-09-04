import { DriveCriteria } from '../types';

export const SUPPORTED_RULE_SET_VERSIONS = ['v1.0.0', 'v1.1.0', 'v1.2.0', 'default'];

export const DEFAULT_DRIVE_CRITERIA: DriveCriteria = {
  min_cgpa: 7.0,
  max_backlogs: 0,
  allowed_branches: ['CSE', 'IT', 'ECE', 'AIDS'],
  min_attendance: 75.0,
  required_skill_tags: ['TypeScript', 'Node.js']
};

export function isValidRuleSetVersion(version: string): boolean {
  return SUPPORTED_RULE_SET_VERSIONS.includes(version) || version.startsWith('v1.');
}
