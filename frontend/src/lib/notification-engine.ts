// frontend/src/lib/notification-engine.ts
// ── Zentrale Notification-Engine für HUI Admin ───────────────────────────────
// Alle Mutationen laufen über Server-API-Routen (service_role)
// Client nutzt ausschließlich fetch() mit Bearer-Token

import { NOTIFICATION_TYPES, isValidNotificationType } from './notification-types';
import type { NotificationType } from './notification-types';

export type { NotificationType };
export { NOTIFICATION_TYPES, isValidNotificationType };

// ── Payload-Typen ─────────────────────────────────────────────────────────────
export interface NotificationPayload {
  user_id:      string;
  type:         NotificationType | string;
  title:        string;
  body:         string;
  entity_id?:   string | null;
  entity_type?: string | null;
  action_url?:  string | null;
  metadata?:    Record<string, unknown>;
}

export interface SendNotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

// ── Client-seitige Hilfsfunktionen (nur fetch, kein direkter DB-Zugriff) ─────

/** Einzelne Notification senden (via Server-API) */
export async function sendNotification(
  payload: NotificationPayload,
  sessionToken: string,
): Promise<SendNotificationResult> {
  try {
    const res = await fetch('/api/notifications', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: json.error ?? `HTTP ${res.status}` };
    return { success: true, notificationId: json.data?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Notification als gelesen markieren (via Server-API) */
export async function markNotificationRead(
  notificationId: string,
  sessionToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ is_read: true }),
    });
    return res.ok;
  } catch { return false; }
}

/** Alle Notifications eines Users als gelesen markieren */
export async function markAllNotificationsRead(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications?action=mark_all_read&user_id=${userId}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    return res.ok;
  } catch { return false; }
}

/** Notification löschen */
export async function deleteNotification(
  notificationId: string,
  sessionToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    return res.ok;
  } catch { return false; }
}

/** Typ-Validierung mit Fallback */
export function validateNotificationType(type: string): NotificationType {
  if (isValidNotificationType(type)) return type;
  return NOTIFICATION_TYPES.SYSTEM;
}
