// frontend/src/lib/hooks/useUsers.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseRealtime } from './useSupabaseRealtime';

export interface MergedUser {
  id: string; email: string | null; created_at: string;
  last_sign_in_at: string | null; display_name: string | null;
  username: string | null; full_name: string | null;
  avatar_url: string | null; role: string; membership_type: string | null;
  is_wirker: boolean; is_member: boolean;
  blocked: boolean; blocked_reason: string | null; blocked_at: string | null;
  phone: string | null; website: string | null; is_deleted: boolean;
  impact_eur: number; trust_score: number; last_seen_at: string | null;
  location_label: string | null;
  source: string;
}

export interface UserCounts {
  total: number; active: number; blocked: number; deleted: number; wirker: number;
}

export type UserFilter = 'all' | 'active' | 'blocked' | 'deleted' | 'wirker';

export interface UseUsersOptions {
  filter?:          UserFilter;
  search?:          string;
  limit?:           number;
  refreshInterval?: number;
}

export function useUsers(options: UseUsersOptions | UserFilter = 'all', legacyInterval?: number) {
  // Rückwärtskompatibilität: useUsers('all') oder useUsers({ filter, search, ... })
  const opts: UseUsersOptions = typeof options === 'string'
    ? { filter: options, refreshInterval: legacyInterval }
    : options;

  const filter          = opts.filter          ?? 'all';
  const search          = opts.search          ?? '';
  const limit           = opts.limit           ?? 1000;
  const refreshInterval = opts.refreshInterval ?? 30000;

  const [users,   setUsers]   = useState<MergedUser[]>([]);
  const [counts,  setCounts]  = useState<UserCounts>({ total:0, active:0, blocked:0, deleted:0, wirker:0 });
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const p = new URLSearchParams({ filter, limit: String(limit) });
      if (search) p.set('search', search);
      const res = await fetch(`/api/users?${p}`, {
        credentials: 'include', cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { users: MergedUser[]; total: number; counts: UserCounts };
      setUsers(data.users   ?? []);
      setTotal(data.total   ?? 0);
      setCounts(data.counts ?? { total:0, active:0, blocked:0, deleted:0, wirker:0 });
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filter, search, limit]);

  useEffect(() => {
    load(false);
    if (refreshInterval > 0) {
      timerRef.current = setInterval(() => load(true), refreshInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, refreshInterval]);

  // Realtime: sofort bei DB-Änderung aktualisieren
  useSupabaseRealtime({ onRefresh: () => load(true), debounceMs: 800 });

  return { users, counts, total, loading, error, refetch: () => load(false) };
}
