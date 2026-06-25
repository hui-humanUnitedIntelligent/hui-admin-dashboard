// frontend/src/lib/impact-status.ts
// Zentrale Status-Definition für Impact Applications
export const APPLICATION_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

export const ALLOWED_STATUS_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  pending:  ['approved', 'rejected'],
  approved: ['rejected'],
  rejected: ['approved'],
};
