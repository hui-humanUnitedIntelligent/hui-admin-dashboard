// frontend/src/lib/session.ts
// Liest den Session-Token ausschließlich aus dem Cookie (nie localStorage).
// Alle API-Calls nutzen credentials:'include' — dieser Helper ist nur noch
// für Legacy-Code der noch einen Token-String erwartet.

export function getSessionToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('hui_admin_token='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}
