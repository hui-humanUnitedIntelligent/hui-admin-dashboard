// frontend/src/app/api/auth/admin-login/route.ts
// POST /api/auth/admin-login
// Prüft Passwort + Rolle, setzt danach NICHT sofort die finale Session --
// 2FA (TOTP) ist Pflicht: statt der finalen Cookies wird eine kurzlebige
// "hui_mfa_pending"-Session gesetzt und der Nutzer zu /login/mfa-enroll
// (noch kein Faktor registriert) oder /login/mfa-challenge (Faktor vorhanden)
// weitergeleitet. Die finalen hui_admin_token/hui_admin_role Cookies werden
// erst nach erfolgreicher 2FA-Verifizierung in /api/auth/mfa/verify gesetzt.

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const PENDING_MAX_AGE = 60 * 10; // 10 Minuten Zeitfenster um die 2FA abzuschließen

async function doLogin(email: string, password: string, dashboard: string) {
  if (!email || !password) {
    return { ok: false as const, error: 'E-Mail und Passwort erforderlich', status: 400 };
  }

  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.session?.access_token || !data.session.refresh_token) {
    return { ok: false as const, error: 'Ungültige Anmeldedaten', status: 401 };
  }

  const { session, user } = data;

  // Rohe Rolle separat halten (bevor normalizeRole() sie verlustbehaftet auf 'employee' faellt --
  // normalizeRole() mappt JEDE unbekannte Rolle wie 'basisuser'/'blocked'/'deleted' auf 'employee',
  // das darf NICHT fuer die Zugriffspruefung verwendet werden, sonst kommt jeder App-Kunde rein).
  let rawRole: string = String(
    (user.app_metadata?.role || user.user_metadata?.role || '') as string
  ).toLowerCase().trim();
  let finalRole = normalizeRole(rawRole || 'employee');

  try {
    const sb = getServiceClient();
    const { data: profile } = await sb
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role) {
      rawRole = String(profile.role).toLowerCase().trim();
      finalRole = normalizeRole(profile.role);
    }
  } catch { /* fallback */ }

  const ADMIN_DASHBOARD_ROLES = ['employee', 'admin', 'superadmin', 'super_admin'];

  if (dashboard === 'admin' && finalRole !== 'superadmin') {
    return { ok: false as const, error: 'Kein Superadmin-Zugriff', status: 403 };
  }

  // Employee-Portal: NUR echte 'employee'/'admin'/'superadmin' Rollen (roh aus DB/app_metadata) duerfen rein.
  // Vorher wurde hier JEDER erfolgreiche Supabase-Login (auch normale App-Kunden mit role='basisuser')
  // durch normalizeRole()'s Fallback faktisch als 'employee' behandelt -- kritische Sicherheitsluecke, jetzt geschlossen.
  if (dashboard === 'employee' && !ADMIN_DASHBOARD_ROLES.includes(rawRole)) {
    return { ok: false as const, error: 'Kein Employee-Zugriff', status: 403 };
  }

  // Cookie-Rolle: Superadmins die das Employee-Portal wählen, bekommen bewusst
  // die 'employee'-Rolle im Cookie (eingeschränkte Sicht), echte finalRole bleibt serverseitig geprüft oben.
  const cookieRole = dashboard === 'employee' ? 'employee' : finalRole;

  // 2FA-Pflicht: prüfen ob der Nutzer schon einen verifizierten TOTP-Faktor hat.
  let mfa: 'enroll' | 'challenge' = 'enroll';
  let factorId: string | undefined;
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factorsData?.totp?.[0];
    if (verifiedTotp) {
      mfa = 'challenge';
      factorId = verifiedTotp.id;
    }
  } catch { /* falls listFactors fehlschlägt -> sicherer Default: enroll erzwingen */ }

  return {
    ok: true as const,
    finalRole: cookieRole,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    mfa,
    factorId,
    status: 200,
  };
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

    if (!result.ok || !result.access_token || !result.refresh_token) {
      if (contentType.includes('application/json')) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }
      // Form-POST Fehler → zurück zum Login
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.error || 'Fehler')}`, req.url), 303
      );
    }

    // Ziel NACH erfolgreicher 2FA (nicht sofort!)
    const finalDest = dashboard === 'employee' ? '/employee/dashboard' : '/dashboard';

    // Pending-2FA-Session: enthält die Supabase-Tokens (aal1) + Rolle + finales Ziel,
    // httpOnly + kurzlebig (10 min). Erst /api/auth/mfa/verify liest sie aus und setzt
    // im Erfolgsfall die echten hui_admin_token/hui_admin_role Cookies.
    const pendingPayload = Buffer.from(JSON.stringify({
      at: result.access_token,
      rt: result.refresh_token,
      role: result.finalRole,
      dest: finalDest,
    })).toString('base64');

    const pendingCookie = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: PENDING_MAX_AGE,
    };

    const mfaRedirect = result.mfa === 'challenge'
      ? `/login/mfa-challenge?factorId=${encodeURIComponent(result.factorId || '')}`
      : '/login/mfa-enroll';

    if (contentType.includes('application/json')) {
      const res = NextResponse.json({ ok: true, mfa: result.mfa, factorId: result.factorId, redirect: mfaRedirect });
      res.cookies.set('hui_mfa_pending', pendingPayload, pendingCookie);
      return res;
    }

    // Form-POST: HTML-Zwischenseite mit JS-Redirect (bewährtes Muster, Cookie sicher gespeichert)
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
    <p>Weiter zur Zwei-Faktor-Bestätigung…</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.replace('${mfaRedirect}');
    }, 100);
  </script>
</body>
</html>`;

    const res = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    res.cookies.set('hui_mfa_pending', pendingPayload, pendingCookie);
    return res;

  } catch (err) {
    console.error('[admin-login]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
