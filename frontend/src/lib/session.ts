// frontend/src/lib/session.ts
// ── Client-seitiger Session-Token-Helper ──────────────────────────────────────
// Liest den Supabase JWT aus localStorage und gibt ihn für Authorization-Header zurück.
// Nur im Browser nutzbar — gibt '' zurück wenn server-seitig aufgerufen.

export function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = JSON.parse(localStorage.getItem(key) || '{}');
        return val?.access_token || '';
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}
