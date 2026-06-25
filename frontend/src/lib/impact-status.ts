// frontend/src/lib/impact-status.ts
// Zentrale Status-Definition für Impact Applications
export const APPLICATION_STATUS = {
  PENDING:  'pending',
  SUBMITTED:'submitted',
  REVIEW:   'review',
  APPROVED: 'approved',
  ACTIVE:   'active',
  REJECTED: 'rejected',
  DELETED:  'deleted',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

/** Alle "Eingereicht / Ausstehend" Status */
export const SUBMITTED_APPLICATION_STATES = [
  'submitted', 'pending', 'review', 'waiting_for_approval',
] as const;

/** Alle "Aktiv / Genehmigt" Status */
export const ACTIVE_APPLICATION_STATES = ['approved', 'active'] as const;

export const ALLOWED_STATUS_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  pending:   ['approved', 'rejected', 'active'],
  submitted: ['approved', 'rejected', 'active'],
  review:    ['approved', 'rejected'],
  approved:  ['rejected', 'active'],
  active:    ['rejected'],
  rejected:  ['approved', 'pending'],
};
