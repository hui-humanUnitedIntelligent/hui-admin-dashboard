// frontend/src/lib/session.ts
// ── Client-seitiger Session-Token-Helper ──────────────────────────────────────
// Liest den hui_admin_token aus dem Cookie (httpOnly=false für Middleware-Kompatibilität).
// Fallback: Supabase localStorage Token für Legacy-Kompatibilität.
// In Chrome Incognito: localStorage ist leer → Cookie ist die einzige Quelle.

export function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    // PRIMARY: hui_admin_token Cookie (gesetzt beim Login, funktioniert in Incognito)
    // Hinweis: httpOnly=true → document.cookie kann es NICHT lesen
    // Der Cookie wird automatisch vom Browser bei credentials:'include' mitgesendet
    // → kein expliziter Token-Header nötig wenn Cookie gesetzt ist

    // FALLBACK: Supabase localStorage Token (nur im normalen Modus verfügbar)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = JSON.parse(localStorage.getItem(key) || '{}');
        if (val?.access_token) return val.access_token;
      }
    }
  } catch {
    /* localStorage nicht verfügbar (Incognito, SSR) — Cookie wird automatisch gesendet */
  }
  return '';
}
