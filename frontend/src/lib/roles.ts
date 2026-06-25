// frontend/src/lib/roles.ts
// ── HUI Admin Dashboard — Rollen-System ──────────────────────────────────────

export type Role = 'superadmin' | 'admin' | 'employee';

/** Normalisiert verschiedene Schreibweisen auf den kanonischen Typ */
export function normalizeRole(role: string | undefined | null): Role {
  if (!role) return 'employee'; // Sicherer Default — KEIN superadmin als Fallback
  const r = String(role).toLowerCase().trim();
  // Admin-Varianten: super_admin, superadmin, admin → superadmin (vollständige Dashboard-Rechte)
  if (r === 'super_admin' || r === 'superadmin' || r === 'admin') return 'superadmin';
  return 'employee';
}

/** Priorität: superadmin > admin > employee */
const ROLE_PRIORITY: Record<string, number> = {
  superadmin:  2,
  super_admin: 2,
  admin:       2, // admin = superadmin im Dashboard-Kontext
  employee:    1,
};

/** Prüft ob ein User die erforderliche Rolle hat */
export function hasRole(
  userRole: string | undefined | null,
  requiredRole: Role,
): boolean {
  const userPriority     = ROLE_PRIORITY[userRole ?? ''] ?? 0;
  const requiredPriority = ROLE_PRIORITY[requiredRole]   ?? 0;
  return userPriority >= requiredPriority;
}

/** Prüft ob User Superadmin ist (super_admin oder superadmin) */
export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === 'super_admin' || role === 'superadmin' || role === 'admin';
}

/** Prüft ob User mindestens Admin ist (super_admin, superadmin, admin) */
export function isAdmin(role: string | undefined | null): boolean {
  return isSuperAdmin(role) || role === 'admin';
}

/** Prüft ob User Employee-Level hat (aber kein Admin) */
export function isEmployee(role: string | undefined | null): boolean {
  return !isAdmin(role) && role === 'employee';
}

/** Gibt das Label für eine Rolle zurück */
export function roleLabel(role: string | undefined | null): string {
  if (isSuperAdmin(role)) return 'Super Admin';
  if (role === 'admin')   return 'Admin';
  return 'Employee';
}

// ── Navigations-Rollen-Matrix ─────────────────────────────────────────────────

/** Alle Routen die ausschließlich für Superadmin zugänglich sind */
export const SUPERADMIN_ONLY_ROUTES = [
  '/admins',
  '/audit',
  '/analytics',
  '/broadcast',
  '/exports',
  '/flags',
  '/impact',
  '/impact-projekte',
  '/ambassadors',
  '/score-failures',
  '/system',
] as const;

/** Prüft ob eine Route superadmin-only ist */
export function isRouteAdminOnly(path: string): boolean {
  return SUPERADMIN_ONLY_ROUTES.some(r => path === r || path.startsWith(r + '/'));
}

/** Gibt die erlaubten Routen für eine Rolle zurück */
export function getAllowedRoutes(role: string | undefined | null): string[] {
  const base = [
    '/dashboard', '/users', '/tickets', '/works', '/experiences',
    '/memberships', '/talents', '/bookings', '/churns', '/reports',
    '/settings', '/reviews', '/transactions',
  ];
  if (isAdmin(role)) {
    return [...base, ...SUPERADMIN_ONLY_ROUTES];
  }
  return base;
}
