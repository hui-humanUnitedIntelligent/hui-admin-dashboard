// frontend/src/lib/api.ts
// ── HUI Admin Dashboard — API Layer ──────────────────────────────────────
// Dual-Mode: Supabase (Live) + Legacy REST Backend
// Alle Live-Daten kommen direkt aus Supabase (HUI App)

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL    || '';
export const SUPABASE_ANON   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Service Role Key wird ausschließlich serverseitig in /api/* Routen verwendet (process.env.SUPABASE_SERVICE_ROLE_KEY)

// ── Supabase REST direct calls (admin/service role) ───────────────────────
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

  // Service Role Key als apikey → RLS wird bypassed (Admin-Dashboard braucht alle Daten)
  
  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
  });

  if (!res.ok) {
    console.error('[sbQuery] error', table, res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sbQuerySingle<T = unknown>(
  table: string,
  params: Record<string, string> = {},
  select = '*'
): Promise<T | null> {
  const rows = await sbQuery<T>(table, params, { select, limit: 1 });
  return rows[0] ?? null;
}

export async function sbCount(table: string, params: Record<string, string> = {}): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return 0;
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', 'id');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  
  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: 'count=exact',
      'Range-Unit': 'items',
      Range: '0-0',
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
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
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
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: 'return=minimal',
    },
  });
  return res.ok;
}

// ── Legacy REST API Client (Backend Express) ──────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('hui_admin_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('hui_admin_token');
      localStorage.removeItem('hui_admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth helpers ──────────────────────────────────────────────────────────
export const getStoredToken  = (): string | null =>
  typeof window === 'undefined' ? null : localStorage.getItem('hui_admin_token');

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

// ── Supabase Auth Admin ───────────────────────────────────────────────────
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
