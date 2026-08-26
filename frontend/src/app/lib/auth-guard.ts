// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth-Guard für Admin API-Routes ─────────────────────────────
// SICHERHEITSFIX (2026-08-26): Rolle wird NICHT mehr aus dem manipulierbaren
// hui_admin_role-Cookie gelesen. Stattdessen wird der JWT (hui_admin_token,
// httpOnly — kann nicht per JS gefälscht werden) gegen Supabase verifiziert
// und die Rolle aus der profiles-Tabelle (DB-SSOT) geholt.
// Der Cookie existiert weiterhin für UI-Routing (middleware.ts) und Frontend-Anzeige
// (Sidebar-Badge/Navigation), ist aber NICHT mehr die sicherheitskritische Quelle —
// httpOnly:false (s. mfa/verify/route.ts REGRESSION-FIX 2026-08-26: httpOnly:true machte
// den Cookie für useAuth.ts unlesbar und kollabierte die gesamte Admin-Navigation).

import { NextRequest, NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';
import { getServiceClient, getAnonClient } from '@/app/lib/supabase-server';

export interface AuthResult {
  user:   { id: string; email: string; role: string } | null;
  error?: string;
  status?: number;
}

// ── In-Memory Cache (30s TTL) — vermeidet DB-Hammering bei Rapid-Fire Calls ──
interface CachedAuth {
  userId: string;
  email: string;
  role: string;
  expiresAt: number;
}
const _authCache = new Map<string, CachedAuth>();
const CACHE_TTL_MS = 30_000; // 30 Sekunden

function getCached(token: string): CachedAuth | null {
  const entry = _authCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _authCache.delete(token);
    return null;
  }
  return entry;
}

function setCached(token: string, data: Omit<CachedAuth, 'expiresAt'>) {
  // Prevent unbounded growth
  if (_authCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of _authCache) {
      if (now > v.expiresAt) _authCache.delete(k);
    }
    if (_authCache.size > 100) {
      const keys = [..._authCache.keys()].slice(0, 50);
      keys.forEach(k => _authCache.delete(k));
    }
  }
  _authCache.set(token, { ...data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Serverseitige Verifikation: JWT → Supabase Session → DB Rolle ──────────
async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.cookies.get('hui_admin_token')?.value;
  if (!token) return { user: null, error: 'Unauthorized', status: 401 };

  // Cache-Check
  const cached = getCached(token);
  if (cached) {
    return { user: { id: cached.userId, email: cached.email, role: cached.role } };
  }

  // 1. JWT gegen Supabase verifizieren (Session gültig?)
  const supabase = getAnonClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return { user: null, error: 'Session expired', status: 401 };
  }

  const userId = authData.user.id;
  const email = authData.user.email ?? '';

  // 2. Rolle aus DB (profiles) holen — SSOT, nicht aus Cookie
  let role = 'employee';
  try {
    const serviceClient = getServiceClient();
    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role) {
      role = normalizeRole(profile.role);
    }
  } catch {
    // Fallback: employee (sicherer Default — KEIN superadmin)
    role = 'employee';
  }

  setCached(token, { userId, email, role });

  return { user: { id: userId, email, role } };
}

// ── guardAdmin: erlaubt superadmin ───────────────────────────────────────
export async function guardAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await verifyAuth(req);
  if (!result.user) {
    return NextResponse.json({ ok: false, error: result.error || 'Unauthorized' }, { status: result.status || 401 });
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
  const result = await verifyAuth(req);
  if (!result.user) {
    return NextResponse.json({ ok: false, error: result.error || 'Unauthorized' }, { status: result.status || 401 });
  }
  return null;
}

// ── guardEmployee: employee oder superadmin ───────────────────────────────
export async function guardEmployee(req: NextRequest): Promise<NextResponse | null> {
  return guardUser(req);
}

// ── requireAdmin ──────────────────────────────────────────────────────────
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await verifyAuth(req);
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
  const result = await verifyAuth(req);
  return result.user ?? null;
}
