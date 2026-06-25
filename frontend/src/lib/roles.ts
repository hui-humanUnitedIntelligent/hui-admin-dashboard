// frontend/src/lib/roles.ts
// ── HUI Admin Dashboard — Rollen-System ──────────────────────────────────────

export type Role = 'superadmin' | 'super_admin' | 'admin' | 'employee';

/** Normalisiert verschiedene Schreibweisen auf den kanonischen Typ */
export function normalizeRole(role: string | undefined | null): Role {
  if (!role) return 'employee';
  if (role === 'super_admin' || role === 'superadmin') return 'superadmin';
  if (role === 'admin') return 'admin';
  return 'employee';
}

/** Priorität: superadmin > admin > employee */
const ROLE_PRIORITY: Record<string, number> = {
  superadmin:  3,
  super_admin: 3,
  admin:       2,
  employee:    1,
};

/** Prüft ob ein User die erforderliche Rolle hat */
export function hasRole(
  userRole: string | undefined | null,
  requiredRole: Role | 'superadmin' | 'admin' | 'employee',
): boolean {
  const userPriority     = ROLE_PRIORITY[userRole ?? ''] ?? 0;
  const requiredPriority = ROLE_PRIORITY[requiredRole]   ?? 0;
  return userPriority >= requiredPriority;
}

/** Prüft ob User Superadmin ist (super_admin oder superadmin) */
export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === 'super_admin' || role === 'superadmin';
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
