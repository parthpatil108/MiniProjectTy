import { AppError } from '../api/middleware/errorEnvelope.js';

export type ApplicationState =
  | 'APPLIED'
  | 'SCREENING'
  | 'RULE_EVALUATED'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'SELECTED'
  | 'OFFER_ISSUED'
  | 'NOT_ELIGIBLE'
  | 'WAITLISTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'COMPENSATION_REQUIRED';

const allowedTransitions: Record<string, ApplicationState[]> = {
  NEW: ['APPLIED'],
  APPLIED: ['SCREENING', 'WITHDRAWN'],
  SCREENING: ['RULE_EVALUATED', 'WITHDRAWN', 'EXPIRED'],
  RULE_EVALUATED: ['SHORTLISTED', 'NOT_ELIGIBLE', 'WAITLISTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'WAITLISTED', 'WITHDRAWN', 'COMPENSATION_REQUIRED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'WAITLISTED', 'WITHDRAWN', 'COMPENSATION_REQUIRED'],
  SELECTED: ['OFFER_ISSUED', 'COMPENSATION_REQUIRED'],
  OFFER_ISSUED: [],
  NOT_ELIGIBLE: [],
  WAITLISTED: ['SHORTLISTED', 'EXPIRED', 'WITHDRAWN'],
  WITHDRAWN: [],
  EXPIRED: [],
  COMPENSATION_REQUIRED: [
    'APPLIED',
    'SCREENING',
    'RULE_EVALUATED',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'SELECTED',
    'WAITLISTED',
    'WITHDRAWN',
  ],
};

export class ApplicationStateMachine {
  public static validateTransition(currentState: string | null | undefined, nextState: ApplicationState): void {
    const fromKey = currentState ? currentState.toUpperCase() : 'NEW';

    const allowed = allowedTransitions[fromKey];
    if (!allowed || !allowed.includes(nextState)) {
      const err: AppError = new Error(
        `Illegal state transition from '${currentState || 'NEW'}' to '${nextState}'`
      );
      err.code = 'STATE_CONFLICT';
      throw err;
    }
  }

  public static isTerminal(state: string): boolean {
    const allowed = allowedTransitions[state.toUpperCase()];
    return allowed ? allowed.length === 0 : false;
  }
}
