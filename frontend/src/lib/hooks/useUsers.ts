// frontend/src/lib/hooks/useUsers.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MergedUser {
  id:              string;
  email:           string | null;
  created_at:      string;
  last_sign_in_at: string | null;
  display_name:    string | null;
  username:        string | null;
  full_name:       string | null;
  avatar_url:      string | null;
  role:            string;
  membership_type: string | null;
  is_wirker:       boolean;
  is_member:       boolean;
  blocked:         boolean;
  is_deleted:      boolean;
  impact_eur:      number;
  trust_score:     number;
  last_seen_at:    string | null;
  source:          'both' | 'auth_only' | 'profile_only';
}

export interface UserCounts {
  total: number; active: number; blocked: number; deleted: number; wirker: number;
}

export type UserFilter = 'all' | 'active' | 'blocked' | 'deleted' | 'wirker';

export function useUsers(opts: {
  filter?: UserFilter; search?: string; limit?: number; offset?: number; refreshInterval?: number;
} = {}) {
  const { filter='active', search='', limit=500, offset=0, refreshInterval=0 } = opts;

  const [users,   setUsers]   = useState<MergedUser[]>([]);
  const [counts,  setCounts]  = useState<UserCounts>({ total:0,active:0,blocked:0,deleted:0,wirker:0 });
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ filter, search, limit: String(limit), offset: String(offset) });
      const res = await fetch(`/api/users?${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // API gibt direkt { users, total, counts } — kein ok()-Wrapper
      setUsers(data.users   ?? []);
      setTotal(data.total   ?? 0);
      setCounts(data.counts ?? { total:0,active:0,blocked:0,deleted:0,wirker:0 });
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [filter, search, limit, offset]);

  useEffect(() => {
    load();
    if (refreshInterval > 0) { timerRef.current = setInterval(load, refreshInterval); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, refreshInterval]);

  return { users, counts, total, loading, error, refetch: load };
}
