// frontend/src/app/api/auth/mfa/verify/route.ts
// POST /api/auth/mfa/verify   { factorId, code }
// Wird für BEIDE Fälle genutzt: Erst-Verifizierung eines gerade eingerichteten Faktors
// (nach /mfa/enroll) UND normale Login-Challenge bei bereits eingerichtetem Faktor.
// Bei Erfolg: finale hui_admin_token/hui_admin_role Cookies setzen, Pending-Cookie löschen.
// SICHERHEITSFIX (2026-08-26): hui_admin_role jetzt httpOnly:true — nicht mehr per JS manipulierbar.
// SESSION-REFRESH-FIX (2026-08-26, Folgefix): zusätzlich hui_admin_refresh (httpOnly) mit dem
// Supabase refresh_token setzen. Ohne diesen Cookie lief die Session nach 3600s (1h) unwiderruflich
// in ein 401 "Session expired" auf JEDER API-Route, da auth-guard.ts seit dem obigen Fix den
// access_token echt gegen Supabase verifiziert (getUser) statt nur die Cookie-Existenz zu prüfen.
// middleware.ts liest hui_admin_refresh und erneuert die Session automatisch vor Ablauf.

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '@/app/lib/supabase-server';

const MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage, wie zuvor bei der finalen Admin-Session

function readPending(req: NextRequest): { at: string; rt: string; role: string; dest: string } | null {
  const raw = req.cookies.get('hui_mfa_pending')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const pending = readPending(req);
  if (!pending) {
    return NextResponse.json({ ok: false, error: 'Sitzung abgelaufen. Bitte erneut einloggen.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const factorId: string = body.factorId || '';
  const code: string = (body.code || '').toString().trim();

  if (!factorId || !code) {
    return NextResponse.json({ ok: false, error: 'Code erforderlich.' }, { status: 400 });
  }

  const supabase = getAnonClient();
  const { error: sessErr } = await supabase.auth.setSession({ access_token: pending.at, refresh_token: pending.rt });
  if (sessErr) {
    return NextResponse.json({ ok: false, error: 'Sitzung ungültig. Bitte erneut einloggen.' }, { status: 401 });
  }

  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error || !data?.access_token) {
    return NextResponse.json({ ok: false, error: error?.message || 'Ungültiger Code.' }, { status: 401 });
  }

  // challengeAndVerify() liefert eine AAL2-Session inkl. frischem refresh_token
  // (Supabase rotiert refresh_token bei jeder Verwendung/Erneuerung) — offizieller Typ
  // AuthMFAVerifyResponseData enthält refresh_token direkt, kein Cast nötig.
  const refreshToken: string | undefined = data.refresh_token;

  const res = NextResponse.json({ ok: true, redirect: pending.dest });
  const cookieBase = { secure: true, sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE };

  res.cookies.set('hui_admin_token', data.access_token, { ...cookieBase, httpOnly: true });
  res.cookies.set('hui_admin_role', pending.role, { ...cookieBase, httpOnly: true });
  if (refreshToken) {
    res.cookies.set('hui_admin_refresh', refreshToken, { ...cookieBase, httpOnly: true });
  }
  res.cookies.set('hui_mfa_pending', '', { path: '/', maxAge: 0 });

  return res;
}
