import { describe, test, expect } from '@jest/globals';
import { ApplicationStateMachine, ApplicationState } from '../../src/services/stateMachine.js';
import { AppError } from '../../src/api/middleware/errorEnvelope.js';

describe('Authoritative Application State Machine Tests', () => {
  const allStates: ApplicationState[] = [
    'APPLIED',
    'SCREENING',
    'RULE_EVALUATED',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'SELECTED',
    'OFFER_ISSUED',
    'NOT_ELIGIBLE',
    'WAITLISTED',
    'WITHDRAWN',
    'EXPIRED',
    'COMPENSATION_REQUIRED'
  ];

  const legalTransitions: [string | null, ApplicationState][] = [
    [null, 'APPLIED'],
    ['NEW', 'APPLIED'],
    ['APPLIED', 'SCREENING'],
    ['APPLIED', 'WITHDRAWN'],
    ['SCREENING', 'RULE_EVALUATED'],
    ['SCREENING', 'WITHDRAWN'],
    ['SCREENING', 'EXPIRED'],
    ['RULE_EVALUATED', 'SHORTLISTED'],
    ['RULE_EVALUATED', 'NOT_ELIGIBLE'],
    ['RULE_EVALUATED', 'WAITLISTED'],
    ['RULE_EVALUATED', 'WITHDRAWN'],
    ['SHORTLISTED', 'INTERVIEW_SCHEDULED'],
    ['SHORTLISTED', 'WAITLISTED'],
    ['SHORTLISTED', 'WITHDRAWN'],
    ['SHORTLISTED', 'COMPENSATION_REQUIRED'],
    ['INTERVIEW_SCHEDULED', 'SELECTED'],
    ['INTERVIEW_SCHEDULED', 'WAITLISTED'],
    ['INTERVIEW_SCHEDULED', 'WITHDRAWN'],
    ['INTERVIEW_SCHEDULED', 'COMPENSATION_REQUIRED'],
    ['SELECTED', 'OFFER_ISSUED'],
    ['SELECTED', 'COMPENSATION_REQUIRED'],
    ['WAITLISTED', 'SHORTLISTED'],
    ['WAITLISTED', 'EXPIRED'],
    ['WAITLISTED', 'WITHDRAWN'],
    ['COMPENSATION_REQUIRED', 'APPLIED'],
    ['COMPENSATION_REQUIRED', 'SHORTLISTED'],
    ['COMPENSATION_REQUIRED', 'SELECTED']
  ];

  test('all legal transitions succeed without error', () => {
    for (const [from, to] of legalTransitions) {
      expect(() => ApplicationStateMachine.validateTransition(from, to)).not.toThrow();
    }
  });

  test('terminal states reject any further transitions with STATE_CONFLICT', () => {
    const terminalStates: ApplicationState[] = ['OFFER_ISSUED', 'NOT_ELIGIBLE', 'WITHDRAWN', 'EXPIRED'];

    for (const term of terminalStates) {
      expect(ApplicationStateMachine.isTerminal(term)).toBe(true);

      for (const targetState of allStates) {
        expect(() => ApplicationStateMachine.validateTransition(term, targetState)).toThrow(
          expect.objectContaining({ code: 'STATE_CONFLICT' })
        );
      }
    }
  });

  test('illegal backwards or skipping transitions throw STATE_CONFLICT (409)', () => {
    const illegalCases: [string, ApplicationState][] = [
      ['APPLIED', 'OFFER_ISSUED'],
      ['APPLIED', 'SELECTED'],
      ['APPLIED', 'INTERVIEW_SCHEDULED'],
      ['SCREENING', 'OFFER_ISSUED'],
      ['RULE_EVALUATED', 'OFFER_ISSUED'],
      ['SHORTLISTED', 'APPLIED'],
      ['INTERVIEW_SCHEDULED', 'APPLIED'],
      ['SELECTED', 'APPLIED'],
      ['SELECTED', 'RULE_EVALUATED'],
      ['WAITLISTED', 'OFFER_ISSUED']
    ];

    for (const [from, to] of illegalCases) {
      try {
        ApplicationStateMachine.validateTransition(from, to);
        throw new Error(`Expected transition ${from} -> ${to} to fail`);
      } catch (err: any) {
        expect(err.code).toBe('STATE_CONFLICT');
      }
    }
  });
});
