// frontend/src/app/lib/auth-guard.ts
// ── Zentraler Auth + Rollen-Guard für alle Admin-Server-Routes ────────────────
// Wird von allen /api/... Admin-Routes importiert.
// Niemals im Client-Bundle — nur in Server Components / Route Handlers.

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from './supabase-server';

export interface AuthResult {
  user: { id: string; email: string } | null;
  error?: string;
  status?: number;
}

/**
 * Validiert den Bearer-Token und prüft Admin-Rolle.
 * Returns { user } bei Erfolg, { user: null, error, status } bei Fehler.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
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

    const isAdmin =
      role  === 'super_admin' ||
      role  === 'admin'       ||
      email.endsWith('@hui-platform.io');

    if (!isAdmin) return { user: null, error: 'Forbidden', status: 403 };

    return { user: { id: user.id, email } };
  } catch {
    return { user: null, error: 'Unauthorized', status: 401 };
  }
}

/**
 * Kurzform: gibt NextResponse zurück bei Fehler, sonst null.
 * Verwendung: const guard = await guardAdmin(req); if (guard) return guard;
 */
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
