// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth + Rollen-Guard für alle Admin-Server-Routes ────────────────

import { NextRequest, NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';
import { getAnonClient, getServiceClient } from './supabase-server';

export interface AuthResult {
  user:   { id: string; email: string; role: string } | null;
  error?: string;
  status?: number;
}

// ── Interne Token-Validierung ─────────────────────────────────────────────────
async function validateToken(req: NextRequest): Promise<AuthResult> {
  // 1. Token aus Cookie oder Bearer-Header
  const cookieToken = req.cookies.get('hui_admin_token')?.value;
  const authHeader  = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token       = cookieToken || bearerToken;

  if (!token) return { user: null, error: 'Unauthorized', status: 401 };

  try {
    const supabase = getAnonClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return { user: null, error: 'Unauthorized', status: 401 };

    const email = user.email ?? '';

    // 2. Rolle bestimmen — Priorität:
    //    a) hui_admin_role Cookie (gesetzt beim Login aus profiles.role)
    //    b) app_metadata.role (Supabase Auth Metadata)
    //    c) user_metadata.role
    //    d) profiles-Tabelle (Service-Role Lookup)
    const cookieRole = req.cookies.get('hui_admin_role')?.value ?? '';
    const metaRole   = (user.app_metadata?.role || user.user_metadata?.role || '') as string;

    let role = cookieRole || metaRole;

    // d) Fallback: direkt aus profiles lesen
    if (!role) {
      try {
        const sb = getServiceClient();
        const { data: profile } = await sb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role ?? '';
      } catch { /* ignore */ }
    }

    return { user: { id: user.id, email, role } };
  } catch {
    return { user: null, error: 'Unauthorized', status: 401 };
  }
}

// ── requireAdmin: min. Admin-Rolle ────────────────────────────────────────────
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await validateToken(req);
  if (!result.user) return result;

  const normalizedRole = normalizeRole(result.user.role);
  if (normalizedRole !== 'superadmin') {
    return { user: null, error: 'Forbidden', status: 403 };
  }
  return result;
}

// ── requireSuperAdmin ─────────────────────────────────────────────────────────
export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult> {
  return requireAdmin(req); // identisch
}

// ── guardAdmin ────────────────────────────────────────────────────────────────
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

// ── guardSuperAdmin ───────────────────────────────────────────────────────────
export async function guardSuperAdmin(req: NextRequest): Promise<NextResponse | null> {
  return guardAdmin(req);
}

// ── guardUser — jeder authentifizierte User ───────────────────────────────────
export async function guardUser(req: NextRequest): Promise<NextResponse | null> {
  const cookieToken = req.cookies.get('hui_admin_token')?.value;
  const authHeader  = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token       = cookieToken || bearerToken;

  if (!token) return NextResponse.json({ ok: false, error: 'Kein Token' }, { status: 401 });

  const sb = getAnonClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return NextResponse.json({ ok: false, error: 'Ungültige Session' }, { status: 401 });
  return null;
}

// ── getAuthUser ───────────────────────────────────────────────────────────────
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  const result = await validateToken(req);
  return result.user ?? null;
}

// ── guardEmployee ─────────────────────────────────────────────────────────────
export async function guardEmployee(req: NextRequest): Promise<NextResponse | null> {
  return guardUser(req);
}
