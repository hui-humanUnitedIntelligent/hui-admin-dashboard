// frontend/src/lib/hooks/useUsers.ts
// useUsers — lädt alle Nutzer via /api/users (auth.users + profiles merged)
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessionToken } from '@/lib/session';
import type { MergedUser } from '@/app/api/users/route';

export type { MergedUser };

export interface UserCounts {
  total:   number;
  active:  number;
  blocked: number;
  deleted: number;
  wirker:  number;
}

export type UserFilter = 'all' | 'active' | 'blocked' | 'deleted' | 'wirker';

export interface UseUsersOptions {
  filter?:          UserFilter;
  search?:          string;
  limit?:           number;
  offset?:          number;
  refreshInterval?: number;
}

export function useUsers(opts: UseUsersOptions = {}) {
  const {
    filter  = 'active',
    search  = '',
    limit   = 500,
    offset  = 0,
    refreshInterval = 0,
  } = opts;

  const [users,   setUsers]   = useState<MergedUser[]>([]);
  const [counts,  setCounts]  = useState<UserCounts>({ total:0, active:0, blocked:0, deleted:0, wirker:0 });
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token  = getSessionToken();
      const params = new URLSearchParams({
        filter,
        search,
        limit:  String(limit),
        offset: String(offset),
      });
      // Cookie (hui_admin_token) wird automatisch via credentials:'include' mitgesendet
      // Token-Header nur als Fallback wenn localStorage verfügbar (nicht Incognito)
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/users?${params}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users   ?? []);
      setTotal(data.total   ?? 0);
      setCounts(data.counts ?? { total:0, active:0, blocked:0, deleted:0, wirker:0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [filter, search, limit, offset]);

  useEffect(() => {
    fetchUsers();
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchUsers, refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchUsers, refreshInterval]);

  return { users, counts, total, loading, error, refetch: fetchUsers };
}
