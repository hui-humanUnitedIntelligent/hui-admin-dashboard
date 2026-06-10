// frontend/src/lib/services/contentService.ts
// ── HUI Admin — Zentraler Content-Service ────────────────────────────────
// Einheitliche Freigabe-/Ablehnungslogik für alle Inhaltstypen.
// Schreibt Audit-Trail in notification_events.
// Triggert Realtime → App sieht die Änderung sofort.

export type ContentTable = 'works' | 'experiences' | 'beitraege' | 'moments' | 'projects';
export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'deleted';

export interface StatusUpdateResult {
  ok:      boolean;
  error?:  string;
}

// ── Hilfsfunktion: Supabase PATCH via API Route ───────────────────────────
// Wir nutzen die bestehende /api/admin route für alle Mutations.
async function callAdminAction(
  action: string,
  userId: string,
  extra: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, ...extra }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── updateStatus ─────────────────────────────────────────────────────────
// Zentrale Funktion für Freigeben / Ablehnen / Löschen aller Inhaltstypen.
export async function updateStatus(
  table: ContentTable,
  id: string,
  status: ContentStatus,
  options: {
    reason?:  string;
    adminId?: string;
  } = {}
): Promise<StatusUpdateResult> {
  const { reason, adminId } = options;

  // ── Mapping: Table + Status → Admin-Action ──────────────────────────
  type ActionMap = Record<ContentTable, Partial<Record<string, string>>>;

  const ACTION_MAP: ActionMap = {
    works:       { approved: 'approve_work',      rejected: 'reject_work',      deleted: 'delete_work'       },
    experiences: { approved: 'approve_experience', rejected: 'reject_experience', deleted: 'delete_experience' },
    projects:    { approved: 'approve_project',    rejected: 'reject_project',    deleted: 'delete_project'    },
    beitraege:   { approved: 'approve_beitrag',    rejected: 'reject_beitrag',    deleted: 'delete_beitrag'    },
    moments:     { approved: 'approve_moment',     rejected: 'reject_moment',     deleted: 'delete_moment'     },
  };

  const action = ACTION_MAP[table]?.[status];

  if (!action) {
    return { ok: false, error: `Keine Admin-Action für ${table}.${status}` };
  }

  // ── Admin-Action aufrufen ────────────────────────────────────────────
  const ok = await callAdminAction(action, id, {
    rejectReason: reason,
    adminId,
  });

  if (!ok) return { ok: false, error: `Admin-Action '${action}' fehlgeschlagen` };

  // ── Audit-Trail (notification_events) ───────────────────────────────
  // Wird in der API Route geschrieben — hier nur Best-Effort client-side log
  console.info(`[contentService] ${table}.${id} → ${status}`, reason ? `| Grund: ${reason}` : '');

  return { ok: true };
}

// ── Convenience-Wrapper ───────────────────────────────────────────────────
export const approveContent = (table: ContentTable, id: string, adminId?: string) =>
  updateStatus(table, id, 'approved', { adminId });

export const rejectContent = (table: ContentTable, id: string, reason: string, adminId?: string) =>
  updateStatus(table, id, 'rejected', { reason, adminId });

export const deleteContent = (table: ContentTable, id: string, adminId?: string) =>
  updateStatus(table, id, 'deleted', { adminId });
