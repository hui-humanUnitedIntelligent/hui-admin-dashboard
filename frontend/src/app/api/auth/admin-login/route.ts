// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Body: { email, password, dashboard: 'admin' | 'employee' }
// Setzt HTTP-Only Cookie: hui_admin_token
import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

export async function POST(req: NextRequest) {
  try {
    const { email, password, dashboard } = await req.json() as {
      email: string;
      password: string;
      dashboard: 'admin' | 'employee';
    };

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
    }

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.access_token) {
      return NextResponse.json({ ok: false, error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }

    const { session, user } = data;
    const appMeta  = user.app_metadata  ?? {};
    const userMeta = user.user_metadata ?? {};
    const rawRole  = appMeta.role || userMeta.role || 'employee';
    const role     = normalizeRole(rawRole);

    // Rollenberechtigung prüfen
    if (dashboard === 'admin' && role !== 'superadmin') {
      // Prüfe auch DB-Profil
      const { getServiceClient } = await import('@/app/lib/supabase-server');
      const sb = getServiceClient();
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
      const dbRole = normalizeRole(profile?.role || '');
      if (dbRole !== 'superadmin') {
        return NextResponse.json({ ok: false, error: 'Kein Superadmin-Zugriff' }, { status: 403 });
      }
    }

    // Effektive Rolle: DB-Profil hat Vorrang
    let finalRole = role;
    try {
      const { getServiceClient } = await import('@/app/lib/supabase-server');
      const sb = getServiceClient();
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role) finalRole = normalizeRole(profile.role);
    } catch { /* Fallback auf Metadata-Rolle */ }

    // HTTP-Only Cookie setzen
    const isProd = process.env.NODE_ENV === 'production';
    const res = NextResponse.json({ ok: true, role: finalRole });

    res.cookies.set('hui_admin_token', session.access_token, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 8, // 8 Stunden
    });

    // Rolle auch als lesbares Cookie (nicht httpOnly) für Client-seitiges Routing
    res.cookies.set('hui_admin_role', finalRole, {
      httpOnly: false,
      secure:   isProd,
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 8,
    });

    return res;
  } catch (err: unknown) {
    console.error('[admin-login]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
