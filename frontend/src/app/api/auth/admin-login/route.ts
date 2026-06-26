// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Akzeptiert JSON (AJAX) oder form-encoded (native Form POST)
// Setzt httpOnly Cookies und redirectet bei Form-POST direkt

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

async function doLogin(email: string, password: string, dashboard: string) {
  if (!email || !password) {
    return { ok: false, error: 'E-Mail und Passwort erforderlich', status: 400 };
  }

  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.session?.access_token) {
    return { ok: false, error: 'Ungültige Anmeldedaten', status: 401 };
  }

  const { session, user } = data;
  const access_token = session.access_token;

  let finalRole = normalizeRole(
    (user.app_metadata?.role || user.user_metadata?.role || 'employee') as string
  );

  try {
    const sb = getServiceClient();
    const { data: profile } = await sb
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role) finalRole = normalizeRole(profile.role);
  } catch { /* fallback */ }

  if (dashboard === 'admin' && finalRole !== 'superadmin') {
    return { ok: false, error: 'Kein Superadmin-Zugriff', status: 403 };
  }

  // Wenn Employee-Portal gewählt: Cookie-Rolle auf 'employee' begrenzen
  // (auch Superadmins bekommen employee-Scope für das EDB)
  const cookieRole = dashboard === 'employee' ? 'employee' : finalRole;

  return { ok: true, finalRole: cookieRole, access_token, status: 200 };
}

function setCookies(response: NextResponse, access_token: string, finalRole: string) {
  const base = {
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
  response.cookies.set('hui_admin_token', access_token, { ...base, httpOnly: true });
  response.cookies.set('hui_admin_role',  finalRole,    { ...base, httpOnly: false });
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let email = '', password = '', dashboard = 'admin';

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      email     = body.email     || '';
      password  = body.password  || '';
      dashboard = body.dashboard || 'admin';
    } else {
      // form-encoded (native Form POST)
      const form = await req.formData().catch(() => new FormData());
      email     = form.get('email')     as string || '';
      password  = form.get('password')  as string || '';
      dashboard = form.get('dashboard') as string || 'admin';
    }

    const result = await doLogin(email, password, dashboard);

    if (!result.ok || !result.access_token) {
      // JSON-Fehler für AJAX, Redirect für Form
      if (contentType.includes('application/json')) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }
      const dest = dashboard === 'employee' ? '/employee/dashboard' : '/dashboard';
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.error || 'Fehler')}`, req.url)
      );
    }

    const dest = dashboard === 'employee' ? '/employee/dashboard' : '/dashboard';

    if (contentType.includes('application/json')) {
      // AJAX: JSON zurück + Cookies setzen
      const res = NextResponse.json({ ok: true, role: result.finalRole });
      return setCookies(res, result.access_token, result.finalRole!);
    } else {
      // Form POST: 302 Redirect + Cookies — Browser setzt Cookies zuverlässig
      const res = NextResponse.redirect(new URL(dest, req.url));
      return setCookies(res, result.access_token, result.finalRole!);
    }
  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
