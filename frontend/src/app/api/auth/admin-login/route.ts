// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Body: { email, password, dashboard: 'admin' | 'employee' }

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const IS_PROD = process.env.NODE_ENV === 'production';
const MAX_AGE = 60 * 60 * 8; // 8 Stunden

// Wichtig: Für Vercel Preview Domains MUSS die Domain gesetzt werden
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || 'hui-admin-dashboard.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const { email, password, dashboard } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'E-Mail und Passwort erforderlich' },
        { status: 400 }
      );
    }

    // 1) Supabase Auth Login
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session?.access_token) {
      return NextResponse.json(
        { ok: false, error: 'Ungültige Anmeldedaten' },
        { status: 401 }
      );
    }

    const { session, user } = data;
    const access_token = session.access_token;

    // 2) Rolle bestimmen (DB-Profil hat Vorrang)
    let finalRole = normalizeRole(
      user.app_metadata?.role ||
        user.user_metadata?.role ||
        'employee'
    );

    try {
      const sb = getServiceClient();
      const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role) {
        finalRole = normalizeRole(profile.role);
      }
    } catch {
      // Fallback auf Metadata-Rolle
    }

    // 3) Admin-Zugriff prüfen
    if (dashboard === 'admin' && finalRole !== 'superadmin') {
      return NextResponse.json(
        { ok: false, error: 'Kein Superadmin-Zugriff' },
        { status: 403 }
      );
    }

    // 4) Cookies setzen (HTTP-Only + Domain-Fix)
    const cookieStore = cookies();

    cookieStore.set({
      name: 'hui_admin_token',
      value: access_token,
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
      domain: COOKIE_DOMAIN,
    });

    cookieStore.set({
      name: 'hui_admin_role',
      value: finalRole,
      httpOnly: false,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
      domain: COOKIE_DOMAIN,
    });

    return NextResponse.json({ ok: true, role: finalRole });
  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json(
      { ok: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
