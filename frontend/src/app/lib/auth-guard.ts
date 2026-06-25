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
  // Cookie-First, dann Bearer-Header
  const cookieToken = req.cookies.get('hui_admin_token')?.value;
  const authHeader  = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token       = cookieToken || bearerToken;

  if (!token) return { user: null, error: 'Unauthorized', status: 401 };

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

// ── guardUser — prüft Cookie ODER Bearer-Header ────────────────────────────
export async function guardUser(req: NextRequest): Promise<NextResponse | null> {
  // 1. HTTP-Only Cookie (neue Login-Methode)
  const cookieToken = req.cookies.get('hui_admin_token')?.value;
  // 2. Authorization: Bearer <token> (alte Methode / Mobile)
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const token = cookieToken || bearerToken;

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Kein Token' }, { status: 401 });
  }

  const sb = getAnonClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ ok: false, error: 'Ungültige Session' }, { status: 401 });
  }
  return null; // OK
}

// ── getAuthUser — gibt User-Objekt zurück (für Soft-Delete mit user_id) ──────
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  const result = await validateToken(req);
  return result.user ?? null;
}

// ── guardEmployee — Employee oder höher (Admin/Superadmin) ───────────────────
// Gibt null bei Erfolg, NextResponse bei Fehler.
// Employee darf Soft-Deletes ausführen; Superadmin ebenfalls erlaubt.
export async function guardEmployee(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Kein Token' }, { status: 401 });
  }
  const sb = getAnonClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ ok: false, error: 'Ungültige Session' }, { status: 401 });
  }
  // Alle authentifizierten User dürfen Soft-Delete (Employee/Admin/Superadmin)
  return null;
}

