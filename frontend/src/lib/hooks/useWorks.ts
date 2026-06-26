// frontend/src/lib/hooks/useWorks.ts
// ── HUI Admin — useWorks Hook (via /api/works Service-Role, kein direktes sbQuery)
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbUpdate } from '../api';
import { getSessionToken } from '@/lib/session';
import type { HuiWork } from './useSupabase';

export type { HuiWork };

export interface UseWorksOptions {
  status?:          string;   // undefined/'all' → alle; 'pending_review'|'published'|... → Filter
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export interface UseWorksReturn {
  works:        HuiWork[];
  total:        number;
  loading:      boolean;
  error:        string | null;
  refetch:      () => void;
  updateStatus: (id: string, status: string, extra?: Record<string, unknown>) => Promise<boolean>;
}

export function useWorks(opts: UseWorksOptions = {}): UseWorksReturn {
  const { status, limit = 1000, refreshInterval = 0, realtime = true } = opts;
  const [works,   setWorks]   = useState<HuiWork[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const channelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch — IMMER über /api/works (Service Role, bypasses RLS) ───────────
  const fetchWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      
      const params = new URLSearchParams({ limit: String(limit) });
      // Nur filtern wenn explizit gesetzt (nicht 'all' oder undefined)
      if (status && status !== 'all') params.set('status', status);

      const res = await fetch(`/api/works?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      // Response ist immer { data: HuiWork[], total: number }
      const rows = Array.isArray(json.data) ? json.data : [];
      setWorks(rows);
      setTotal(json.total ?? rows.length);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      console.error('[useWorks]', msg);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  // ── Realtime-Subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel('admin:works:realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'works' }, () => {
        fetchWorks();
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchWorks]);

  // ── Initial fetch + Polling ───────────────────────────────────────────────
  useEffect(() => {
    fetchWorks();
    if (refreshInterval > 0) {
      const id = setInterval(fetchWorks, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchWorks, refreshInterval]);

  // ── updateStatus — optimistic + Rollback ─────────────────────────────────
  const updateStatus = useCallback(async (
    id: string,
    newStatus: string,
    extra: Record<string, unknown> = {}
  ): Promise<boolean> => {
    setWorks(prev => prev.map(w => w.id === id ? { ...w, status: newStatus, ...extra } : w));
    const ok = await sbUpdate('works', id, { status: newStatus, ...extra });
    if (!ok) fetchWorks();
    return ok;
  }, [fetchWorks]);

  return { works, total, loading, error, refetch: fetchWorks, updateStatus };
}
