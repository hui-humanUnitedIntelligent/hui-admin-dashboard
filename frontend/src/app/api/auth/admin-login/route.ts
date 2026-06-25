// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Body: { email, password, dashboard: 'admin' | 'employee' }
// Setzt HTTP-Only Cookie via next/headers cookies()
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAnonClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const DOMAIN   = process.env.COOKIE_DOMAIN ?? undefined; // undefined = aktueller Host
const IS_PROD  = process.env.NODE_ENV === 'production';
const MAX_AGE  = 60 * 60 * 8; // 8 Stunden

export async function POST(req: NextRequest) {
  try {
    const { email, password, dashboard } = await req.json() as {
      email:     string;
      password:  string;
      dashboard: 'admin' | 'employee';
    };

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
    }

    // ── 1. Supabase Auth ────────────────────────────────────────────────────
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.access_token) {
      return NextResponse.json({ ok: false, error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }

    const { session, user } = data;
    const access_token = session.access_token;

    // ── 2. Rolle ermitteln (DB-Profil hat Vorrang) ──────────────────────────
    const appMeta  = user.app_metadata  ?? {};
    const userMeta = user.user_metadata ?? {};
    const rawRole  = appMeta.role || userMeta.role || 'employee';
    let   finalRole = normalizeRole(rawRole);

    try {
      const { getServiceClient } = await import('@/app/lib/supabase-server');
      const sb = getServiceClient();
      const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role) finalRole = normalizeRole(profile.role);
    } catch { /* Fallback auf Metadata-Rolle */ }

    // ── 3. Admin-Rollencheck ────────────────────────────────────────────────
    if (dashboard === 'admin' && finalRole !== 'superadmin') {
      return NextResponse.json({ ok: false, error: 'Kein Superadmin-Zugriff' }, { status: 403 });
    }

    // ── 4. Cookies setzen via next/headers ─────────────────────────────────
    const cookieStore = cookies();

    cookieStore.set({
      name:     'hui_admin_token',
      value:    access_token,
      httpOnly: true,
      secure:   IS_PROD,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
      ...(DOMAIN ? { domain: DOMAIN } : {}),
    });

    cookieStore.set({
      name:     'hui_admin_role',
      value:    finalRole,
      httpOnly: false,
      secure:   IS_PROD,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
      ...(DOMAIN ? { domain: DOMAIN } : {}),
    });

    return NextResponse.json({ ok: true, role: finalRole });

  } catch (err: unknown) {
    console.error('[admin-login]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
