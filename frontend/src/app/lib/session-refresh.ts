// frontend/src/app/lib/session-refresh.ts
// ── Session-Refresh-Helfer (2026-08-26) ───────────────────────────────────
// FIX für Regression aus Commit 462c114 ("Cookie-Rollen-Fälschung geschlossen"):
// Dieser Commit hat guardAdmin/guardUser dahin geändert, dass der Supabase
// access_token (hui_admin_token) via getUser() ECHT verifiziert wird — das ist
// korrekt und sicher. ABER: Supabase access_tokens laufen nach 3600s (1h) ab,
// und es gab KEINEN Refresh-Mechanismus. Der Cookie hatte maxAge=7 Tage, aber
// der JWT darin wurde nach 1h ungültig -> ALLE API-Routen lieferten ab dann
// 401 "Session expired", bis der Nutzer sich neu einloggt. Root Cause des
// "alles leer in der App"-Reports (Screenshot 2026-08-26 22:08).
//
// Fix: refresh_token wird jetzt zusätzlich in einem httpOnly-Cookie gespeichert
// (siehe mfa/verify/route.ts). Diese Funktion prüft die Ablaufzeit des JWT
// (reine Payload-Dekodierung, keine Netzwerk-Rundreise) und erneuert die
// Session via Supabase REST Token-Endpoint, BEVOR der access_token abläuft.
// Wird aus middleware.ts für JEDEN Request (Seiten + API) aufgerufen.
//
// WICHTIG: middleware.ts läuft auf der Next.js Edge Runtime — Buffer ist dort
// NICHT garantiert als globaler Wert verfügbar. Deshalb wird hier atob()
// verwendet (Standard-Edge-Runtime-Global), nicht Buffer.from().

export interface RefreshResult {
  refreshed: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  invalid?: boolean; // true = refresh_token selbst ungültig/abgelaufen -> Login nötig
}

const REFRESH_BUFFER_SECONDS = 120; // 2 Minuten vor Ablauf erneuern

/** Dekodiert die JWT-Payload OHNE Signaturprüfung — nur um 'exp' zu lesen.
 *  Sicherheitskritische Prüfung passiert weiterhin in auth-guard.ts via
 *  supabase.auth.getUser(). Hier geht es nur um "ist ein Refresh nötig?". */
function decodeExp(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    // Base64URL -> Base64 (+ Padding), dann atob (Edge-Runtime-safe, kein Buffer nötig)
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const json = decodeURIComponent(
      binary
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Prüft ob der access_token abgelaufen ist oder in Kürze abläuft. */
export function needsRefresh(accessToken: string): boolean {
  const exp = decodeExp(accessToken);
  if (exp === null) return true; // kann nicht dekodiert werden -> sicherheitshalber erneuern
  const nowSec = Date.now() / 1000;
  return nowSec >= exp - REFRESH_BUFFER_SECONDS;
}

/** Erneuert die Supabase-Session via REST-Endpoint (Edge-Runtime-kompatibel,
 *  kein supabase-js-Client nötig — reines fetch). */
export async function refreshSession(refreshToken: string): Promise<RefreshResult> {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anon || !refreshToken) {
    return { refreshed: false, invalid: true };
  }

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // 400/401 = refresh_token ungültig/abgelaufen/schon verbraucht (rotiert)
      return { refreshed: false, invalid: true };
    }

    const data = await res.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number;
    };

    if (!data.access_token || !data.refresh_token) {
      return { refreshed: false, invalid: true };
    }

    return {
      refreshed: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch {
    // Netzwerkfehler — NICHT als "invalid" werten (kein Login-Zwang bei Supabase-Hiccup),
    // stattdessen einfach nicht erneuern und den bestehenden (evtl. noch gültigen) Token
    // weiterverwenden lassen; auth-guard.ts entscheidet dann via getUser() endgültig.
    return { refreshed: false };
  }
}
