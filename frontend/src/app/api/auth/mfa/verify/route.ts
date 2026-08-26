// frontend/src/app/api/auth/mfa/verify/route.ts
// POST /api/auth/mfa/verify   { factorId, code }
// Wird für BEIDE Fälle genutzt: Erst-Verifizierung eines gerade eingerichteten Faktors
// (nach /mfa/enroll) UND normale Login-Challenge bei bereits eingerichtetem Faktor.
// Bei Erfolg: finale hui_admin_token/hui_admin_role Cookies setzen, Pending-Cookie löschen.
// SICHERHEITSFIX (2026-08-26): hui_admin_token ist httpOnly:true (JWT, sicherheitskritisch —
// darf nie per JS lesbar sein). Rolle wird server-seitig NICHT mehr aus dem Cookie vertraut:
// auth-guard.ts (verifyAuth) liest die Rolle ausschließlich aus der profiles-Tabelle (DB-SSOT)
// über den verifizierten JWT — der hui_admin_role-Cookie ist seitdem NICHT mehr
// sicherheitsrelevant, sondern dient nur noch (a) middleware.ts für UI-Routing (Employee- vs.
// Superadmin-Bereiche) und (b) dem Frontend (useAuth.ts) für Badge/Nav-Anzeige. Ein Angreifer,
// der diesen Cookie per XSS fälscht, kann dadurch höchstens UI-Elemente sehen, aber KEINE
// echten Admin-API-Calls ausführen (die prüfen die DB-Rolle, nicht den Cookie) — daher bewusst
// httpOnly:false, s. Regression-Fix unten.
// REGRESSION-FIX (2026-08-26, Folgefix): httpOnly:true auf hui_admin_role hatte einen
// ungewollten Nebeneffekt — useAuth.ts liest die Rolle client-seitig per document.cookie fürs
// UI (Sidebar-Navigation, Superadmin-Badge). httpOnly-Cookies sind für JS unsichtbar, dadurch
// war role dort IMMER undefined → komplette Sidebar-Navigation kollabierte auf nur noch den
// hartcodierten "Dashboard"-Link (AdminNavigation filtert alle Gruppen nach role, leere Rolle
// = "employee"-Ansicht = keine sichtbaren Gruppen). Zurück auf httpOnly:false — die eigentliche
// Sicherheitslücke (API vertraute dem Cookie als Rollen-Quelle) ist bereits durch auth-guard.ts
// geschlossen, unabhängig von httpOnly hier.
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
  // httpOnly:false — bewusst, s. REGRESSION-FIX-Kommentar oben. Nur UI-Anzeige, nicht
  // sicherheitsrelevant (auth-guard.ts vertraut ausschließlich der DB-Rolle).
  res.cookies.set('hui_admin_role', pending.role, { ...cookieBase, httpOnly: false });
  if (refreshToken) {
    res.cookies.set('hui_admin_refresh', refreshToken, { ...cookieBase, httpOnly: true });
  }
  res.cookies.set('hui_mfa_pending', '', { path: '/', maxAge: 0 });

  return res;
}
