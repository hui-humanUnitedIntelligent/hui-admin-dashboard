// frontend/src/lib/impact-status.ts
// Echte DB-Statuswerte für Impact (ermittelt via SELECT DISTINCT)
// impact_applications:  approved | rejected
// impact_projects:      active | voting | won | archived

export const APPLICATION_STATUS = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

/** Impact Applications — direkt "approved" nach Einreichung in der HUI-App */
export const SUBMITTED_APPLICATION_STATES = ['approved'] as const;

/** Impact Projects — aktive Zustände */
export const ACTIVE_PROJECT_STATES   = ['active', 'voting', 'won'] as const;
export const ARCHIVED_PROJECT_STATES = ['archived'] as const;

export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:  ['approved', 'rejected'],
  approved: ['rejected'],
  rejected: ['approved'],
};
