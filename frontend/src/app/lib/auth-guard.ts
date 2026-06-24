// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth + Rollen-Guard für alle Admin-Server-Routes ────────────────
// Wird von allen /api/... Admin-Routes importiert.
// Niemals im Client-Bundle — nur in Server Components / Route Handlers.

import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  user: { id: string; email: string } | null;
  error?: string;
  status?: number;
}

/**
 * Validiert den Bearer-Token aus dem Authorization-Header und prüft,
 * ob der Nutzer die Rolle super_admin / admin hat oder eine @hui-platform.io E-Mail besitzt.
 *
 * Returns: { user } bei Erfolg
 * Returns: { user: null, error, status: 401 | 403 } bei Fehler
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  // ── 1. Authorization-Header prüfen ──────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { user: null, error: 'Unauthorized', status: 401 };
  }

  // ── 2. JWT über Supabase /auth/v1/user validieren ───────────────────────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey:        supabaseAnon,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { user: null, error: 'Unauthorized', status: 401 };
    data = await res.json();
  } catch {
    return { user: null, error: 'Unauthorized', status: 401 };
  }

  if (!data?.id) {
    return { user: null, error: 'Unauthorized', status: 401 };
  }

  // ── 3. Rollen-Prüfung ────────────────────────────────────────────────────────
  const appMeta  = (data?.app_metadata  as Record<string, unknown>) ?? {};
  const userMeta = (data?.user_metadata as Record<string, unknown>) ?? {};

  const role  = (appMeta?.role  as string) || (userMeta?.role as string) || '';
  const email = (data?.email    as string) || '';

  const isAdmin =
    role  === 'super_admin' ||
    role  === 'admin'       ||
    email.endsWith('@hui-platform.io');

  if (!isAdmin) {
    return { user: null, error: 'Forbidden', status: 403 };
  }

  return { user: { id: data.id as string, email } };
}

/**
 * Kurzform: gibt bei Fehler direkt eine NextResponse zurück, sonst null.
 * Verwendung: const guard = await guardAdmin(req); if (guard) return guard;
 */
export async function guardAdmin(req: NextRequest): Promise<NextResponse | null> {
  const result = await requireAdmin(req);
  if (!result.user) {
    return NextResponse.json(
      { error: result.error || 'Unauthorized' },
      { status: result.status ?? 401 }
    );
  }
  return null;
}
