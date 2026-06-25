// frontend/src/lib/status-constants.ts
// ── Zentrale Status-Konstanten für ALLE Content-Bereiche ──────────────────
// Wird von API-Routes, Hooks und UI-Komponenten verwendet.

/** Alle Status-Werte, die "eingereicht / wartet auf Review" bedeuten */
export const SUBMITTED_STATES = [
  'submitted',
  'pending',
  'pending_review',
  'review',
  'waiting_for_approval',
] as const;

/** Alle nicht-gelöschten Status */
export const VISIBLE_STATES = [
  'submitted', 'pending', 'pending_review', 'review',
  'waiting_for_approval', 'published', 'approved', 'active',
  'draft', 'rejected', 'flagged', 'sensitive',
] as const;

export type SubmittedState = typeof SUBMITTED_STATES[number];

/** Prüft ob ein Status-Wert "eingereicht" bedeutet */
export function isSubmitted(status: string | null | undefined): boolean {
  return SUBMITTED_STATES.includes((status ?? '') as SubmittedState);
}

/** Normalisiert Status für UI-Anzeige */
export function normalizeStatus(status: string | null | undefined, approvalStatus?: string | null): string {
  if (approvalStatus === 'approved') return 'published';
  if (approvalStatus === 'rejected') return 'rejected';
  if (approvalStatus === 'pending' || status === 'pending_review') return 'pending';
  return status ?? 'unknown';
}
