// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth-Guard für Admin API-Routes ─────────────────────────────
// Strategie: Cookie-basierte Validierung (schnell, kein Supabase-Roundtrip).
// Der hui_admin_token Cookie wird nur auf Existenz geprüft — die Middleware
// hat bereits serverseitig sichergestellt, dass nur authentifizierte Requests
// ankommen. getUser() wird NICHT mehr aufgerufen (JWT läuft nach 1h ab).

import { NextRequest, NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';

export interface AuthResult {
  user:   { id: string; email: string; role: string } | null;
  error?: string;
  status?: number;
}

// ── Validierung via Cookie — kein async Supabase-Call ─────────────────────
function validateCookie(req: NextRequest): AuthResult {
  const token     = req.cookies.get('hui_admin_token')?.value;
  const cookieRole = req.cookies.get('hui_admin_role')?.value ?? '';

  if (!token) return { user: null, error: 'Unauthorized', status: 401 };

  const role = normalizeRole(cookieRole || 'employee');

  // Aus JWT sub lesen ohne Verifikation (nur für Logging, nicht sicherheitskritisch)
  let userId = 'unknown';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = payload.sub ?? 'unknown';
  } catch { /* ignore */ }

  return { user: { id: userId, email: '', role } };
}

// ── guardAdmin: erlaubt superadmin ───────────────────────────────────────
export async function guardAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = validateCookie(req);
  if (!result.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (result.user.role !== 'superadmin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ── guardSuperAdmin ───────────────────────────────────────────────────────
export async function guardSuperAdmin(req: NextRequest): Promise<NextResponse | null> {
  return guardAdmin(req);
}

// ── guardUser: jeder authentifizierte User ────────────────────────────────
export async function guardUser(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get('hui_admin_token')?.value;
  if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  return null;
}

// ── guardEmployee: employee oder superadmin ───────────────────────────────
export async function guardEmployee(req: NextRequest): Promise<NextResponse | null> {
  return guardUser(req);
}

// ── requireAdmin ──────────────────────────────────────────────────────────
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = validateCookie(req);
  if (!result.user) return result;
  if (result.user.role !== 'superadmin') {
    return { user: null, error: 'Forbidden', status: 403 };
  }
  return result;
}

// ── requireSuperAdmin ─────────────────────────────────────────────────────
export async function requireSuperAdmin(req: NextRequest): Promise<AuthResult> {
  return requireAdmin(req);
}

// ── getAuthUser ───────────────────────────────────────────────────────────
export async function getAuthUser(req: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  const result = validateCookie(req);
  return result.user ?? null;
}
