// frontend/src/lib/status-constants.ts
// ── ECHTE DB-Statuswerte (ermittelt via SELECT DISTINCT status) ───────────
// works:                pending_review | published | rejected | deleted
// experiences:          pending_review | published
// impact_projects:      active | voting | won | archived
// impact_applications:  approved | rejected

/** Werke/Erlebnisse — eingereicht, wartet auf Review */
export const SUBMITTED_STATES = ['pending_review'] as const;

/** Impact Applications — nach Einreichung direkt "approved" in DB */
export const SUBMITTED_APPLICATION_STATES = ['approved'] as const;

/** Impact Projects — laufende/aktive Projekte */
export const ACTIVE_PROJECT_STATES = ['active', 'voting', 'won'] as const;

/** Impact Projects — archiviert */
export const ARCHIVED_PROJECT_STATES = ['archived'] as const;

export type SubmittedState = typeof SUBMITTED_STATES[number];

/** Prüft ob ein Werk/Erlebnis eingereicht ist */
export function isSubmitted(status: string | null | undefined): boolean {
  return (status ?? '') === 'pending_review';
}

/** Normalisiert status für UI-Anzeige */
export function normalizeStatus(status: string | null | undefined): string {
  if (status === 'pending_review') return 'pending';
  if (status === 'published')      return 'published';
  if (status === 'rejected')       return 'rejected';
  if (status === 'deleted')        return 'deleted';
  return status ?? 'unknown';
}
