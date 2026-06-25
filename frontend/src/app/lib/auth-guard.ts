// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth + Rollen-Guard für alle Admin-Server-Routes ────────────────
// Wird von allen /api/... Admin-Routes importiert.
// Niemals im Client-Bundle — nur in Server Components / Route Handlers.

import { NextRequest, NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';
import { getAnonClient } from './supabase-server';

export interface AuthResult {
  user:   { id: string; email: string; role: string } | null;
  error?: string;
  status?: number;
}

// ── Interne Token-Validierung ─────────────────────────────────────────────────
async function validateToken(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { user: null, error: 'Unauthorized', status: 401 };

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token)   return { user: null, error: 'Unauthorized', status: 401 };

  try {
    const supabase = getAnonClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return { user: null, error: 'Unauthorized', status: 401 };

    const appMeta  = user.app_metadata  ?? {};
    const userMeta = user.user_metadata ?? {};
    const role     = (appMeta.role || userMeta.role || '') as string;
    const email    = user.email ?? '';

    return { user: { id: user.id, email, role } };
  } catch {
    return { user: null, error: 'Unauthorized', status: 401 };
  }
}

// ── requireAdmin: min. Admin-Rolle ────────────────────────────────────────────
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await validateToken(req);
  if (!result.user) return result;

  const { role } = result.user;
  const normalizedRole = normalizeRole(role);
  // Nur normalisierte Rolle — kein E-Mail-Domain-Bypass (Security)
  if (normalizedRole !== 'superadmin') return { user: null, error: 'Forbidden', status: 403 };
  return result;
}

// ── requireSuperAdmin: nur super_admin / superadmin ───────────────────────────
export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await validateToken(req);
  if (!result.user) return result;

  const { role } = result.user;
  const normalizedRole = normalizeRole(role);
  // Single source of truth: normalizeRole() — kein E-Mail-Bypass
  if (normalizedRole !== 'superadmin') return { user: null, error: 'Forbidden — Superadmin required', status: 403 };
  return result;
}

// ── guardAdmin: Kurzform (gibt Response bei Fehler, sonst null) ───────────────
export async function guardAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await requireAdmin(req);
  if (!result.user) {
    return NextResponse.json(
      { ok: false, error: result.error ?? 'Unauthorized' },
      { status: result.status ?? 401 }
    );
  }
  return null;
}

// ── guardSuperAdmin: Kurzform für Superadmin-only Routes ─────────────────────
export async function guardSuperAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await requireSuperAdmin(req);
  if (!result.user) {
    return NextResponse.json(
      { ok: false, error: result.error ?? 'Forbidden' },
      { status: result.status ?? 403 }
    );
  }
  return null;
}
