// frontend/src/lib/notification-types.ts
// ── Zentrale Notification-Typ-Definitionen für HUI ───────────────────────────

export const NOTIFICATION_TYPES = {
  // System & Admin
  SYSTEM:           'system',
  BROADCAST:        'admin_broadcast',
  // Support
  TICKET_REPLY:     'support_reply',
  TICKET_CLOSED:    'ticket_closed',
  // Impact
  IMPACT_UPDATE:    'impact_update',
  IMPACT_APPROVED:  'impact_project_approved',
  IMPACT_REJECTED:  'impact_project_rejected',
  IMPACT_DELETED:   'impact_project_deleted',
  // Ambassador
  AMBASSADOR_EVENT: 'ambassador_event',
  AMBASSADOR_APPROVED: 'ambassador_approved',
  AMBASSADOR_REJECTED: 'ambassador_rejected',
  AMBASSADOR_REVOKED:  'ambassador_revoked',
  // Gamification
  LEVEL_UP:         'level_up',
  REWARD_GRANTED:   'reward_granted',
  MILESTONE:        'milestone_reached',
  // Buchungen & Transaktionen
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  PAYMENT_RECEIVED:  'payment_received',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Validiert ob ein String ein bekannter Notification-Typ ist
export function isValidNotificationType(type: string): type is NotificationType {
  return Object.values(NOTIFICATION_TYPES).includes(type as NotificationType);
}

// Gibt Icon für einen Notification-Typ zurück
export function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    [NOTIFICATION_TYPES.SYSTEM]:              '⚙️',
    [NOTIFICATION_TYPES.BROADCAST]:           '📣',
    [NOTIFICATION_TYPES.TICKET_REPLY]:        '💬',
    [NOTIFICATION_TYPES.TICKET_CLOSED]:       '✅',
    [NOTIFICATION_TYPES.IMPACT_APPROVED]:     '💚',
    [NOTIFICATION_TYPES.IMPACT_REJECTED]:     '📋',
    [NOTIFICATION_TYPES.IMPACT_DELETED]:      '🗑️',
    [NOTIFICATION_TYPES.AMBASSADOR_APPROVED]: '🤝',
    [NOTIFICATION_TYPES.AMBASSADOR_REJECTED]: '❌',
    [NOTIFICATION_TYPES.AMBASSADOR_REVOKED]:  '🚫',
    [NOTIFICATION_TYPES.LEVEL_UP]:            '⬆️',
    [NOTIFICATION_TYPES.REWARD_GRANTED]:      '🎁',
    [NOTIFICATION_TYPES.MILESTONE]:           '🏆',
    [NOTIFICATION_TYPES.BOOKING_CONFIRMED]:   '📅',
    [NOTIFICATION_TYPES.PAYMENT_RECEIVED]:    '💰',
  };
  return icons[type] ?? '🔔';
}
