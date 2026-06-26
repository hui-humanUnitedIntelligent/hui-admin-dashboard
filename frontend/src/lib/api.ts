// frontend/src/lib/api.ts
// ── HUI Admin Dashboard — API Layer ──────────────────────────────────────────
// Supabase REST Layer (client-seitig, Anon-Key)
// Schreibzugriffe (PATCH/DELETE auf sensible Tabellen) → /app/api/* Routen mit Service Key

export const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL    || '';
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Service Role Key: ausschließlich serverseitig in /app/api/* Routen (process.env.SUPABASE_SERVICE_ROLE_KEY)

// ── Supabase REST — Lese-Wrapper (Anon-Key) ───────────────────────────────────
export async function sbQuery<T = unknown>(
  table: string,
  params: Record<string, string> = {},
  options: { select?: string; order?: string; limit?: number; offset?: number } = {}
): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return [];

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', options.select || '*');
  if (options.order)  url.searchParams.set('order',  options.order);
  if (options.limit)  url.searchParams.set('limit',  String(options.limit));
  if (options.offset) url.searchParams.set('offset', String(options.offset));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      apikey:         SUPABASE_ANON,
      'Content-Type': 'application/json',
      Prefer:         'count=exact',
    },
  });

  if (!res.ok) {
    console.error('[sbQuery] error', table, res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sbCount(table: string, params: Record<string, string> = {}): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return 0;

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', 'id');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_ANON,
      Prefer:        'count=exact',
      'Range-Unit':  'items',
      Range:         '0-0',
    },
  });

  const rangeHeader = res.headers.get('content-range');
  if (rangeHeader) {
    const match = rangeHeader.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export async function sbUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return false;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey:         SUPABASE_ANON,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function sbDelete(table: string, id: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return false;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey:        SUPABASE_ANON,
      Prefer:        'return=minimal',
    },
  });
  return res.ok;
}

// ── Auth helpers (Legacy — Supabase Session + hui_admin_token) ────────────────
// Genutzt von: useAuth.ts, AuthGuard.tsx, Header.tsx, Sidebar.tsx, DashboardLayout.tsx

export const storeAuth = (token: string, user: object): void => {
  localStorage.setItem('hui_admin_token', token);
  localStorage.setItem('hui_admin_user', JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem('hui_admin_token');
  localStorage.removeItem('hui_admin_user');
};

export const getStoredUser = (): Record<string, unknown> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hui_admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ── Supabase Auth Login ────────────────────────────────────────────────────────
export async function supabaseAdminLogin(email: string, password: string) {
  if (!SUPABASE_URL) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return res.json();
}
