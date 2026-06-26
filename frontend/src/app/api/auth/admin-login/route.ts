// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Body: { email, password, dashboard: 'admin' | 'employee' }

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const MAX_AGE = 60 * 60 * 8; // 8 Stunden

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

    // 4) Cookies setzen — KEINE domain-Angabe (gilt automatisch für aktuelle Host-Domain)
    //    secure: true nur auf echtem HTTPS (Vercel Production + Preview sind beide HTTPS)
    const response = NextResponse.json({ ok: true, role: finalRole });

    const cookieOpts = {
      httpOnly: true,
      secure: true,           // Vercel ist immer HTTPS
      sameSite: 'lax' as const,
      path: '/',
      maxAge: MAX_AGE,
      // Kein domain: — Browser setzt Cookie automatisch für aktuelle Domain
    };

    response.cookies.set('hui_admin_token', access_token, cookieOpts);
    response.cookies.set('hui_admin_role', finalRole, {
      ...cookieOpts,
      httpOnly: false,         // Middleware + Client müssen Role lesen können
    });

    return response;
  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json(
      { ok: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
