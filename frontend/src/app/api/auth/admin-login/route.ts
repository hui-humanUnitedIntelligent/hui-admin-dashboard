// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Setzt Cookies und gibt HTML-Seite mit Meta-Refresh zurück
// → zuverlässige Cookie-Persistenz in allen Browsern auf Vercel

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
  const cookieRole = dashboard === 'employee' ? 'employee' : finalRole;

  return { ok: true, finalRole: cookieRole, access_token, status: 200 };
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
      const form = await req.formData().catch(() => new FormData());
      email     = form.get('email')     as string || '';
      password  = form.get('password')  as string || '';
      dashboard = form.get('dashboard') as string || 'admin';
    }

    const result = await doLogin(email, password, dashboard);

    if (!result.ok || !result.access_token) {
      if (contentType.includes('application/json')) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }
      // Form-POST Fehler → zurück zum Login
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.error || 'Fehler')}`, req.url), 303
      );
    }

    const dest = dashboard === 'employee' ? '/employee/dashboard' : '/dashboard';
    const cookieBase = {
      secure: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: MAX_AGE,
    };

    if (contentType.includes('application/json')) {
      // AJAX: JSON + Cookies
      const res = NextResponse.json({ ok: true, role: result.finalRole });
      res.cookies.set('hui_admin_token', result.access_token, { ...cookieBase, httpOnly: true });
      res.cookies.set('hui_admin_role',  result.finalRole!,   { ...cookieBase, httpOnly: false });
      return res;
    }

    // Form-POST: HTML-Zwischenseite mit JS-Redirect
    // Cookies werden per Set-Cookie gesetzt, dann JS navigiert
    // → Browser hat garantiert Zeit die Cookies zu speichern
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Anmelden…</title>
  <style>
    body { margin:0; background:#0F1117; display:flex; align-items:center;
           justify-content:center; min-height:100vh; font-family:sans-serif; }
    .box { text-align:center; color:#4ECDC4; }
    .spinner { width:32px; height:32px; border:3px solid rgba(78,205,196,0.2);
               border-top-color:#4ECDC4; border-radius:50%;
               animation:spin 0.7s linear infinite; margin:0 auto 16px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    p { color:#8892A4; font-size:13px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p>Wird weitergeleitet…</p>
  </div>
  <script>
    // Kleine Verzögerung damit Browser Cookies aus Set-Cookie Header speichert
    setTimeout(function() {
      window.location.replace('${dest}');
    }, 100);
  </script>
</body>
</html>`;

    const res = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    res.cookies.set('hui_admin_token', result.access_token, { ...cookieBase, httpOnly: true });
    res.cookies.set('hui_admin_role',  result.finalRole!,   { ...cookieBase, httpOnly: false });
    return res;

  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
