// frontend/src/lib/hooks/useWorks.ts
// ── HUI Admin — useWorks Hook mit Realtime ───────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate } from '../api';
import type { HuiWork } from './useSupabase';

export type { HuiWork };

export interface UseWorksOptions {
  status?:          string;
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
  const { status, limit = 50, refreshInterval = 0, realtime = true } = opts;
  const [works,   setWorks]   = useState<HuiWork[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const channelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────
  const fetchWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const needsServiceRole =
        status === 'flagged' || status === 'deleted' ||
        status === 'pending_review' || status === 'rejected' ||
        status === 'pending';

      if (needsServiceRole) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (status) params.set('status', status);
        const res = await fetch(`/api/works?${params}`);
        if (res.ok) {
          const rows = (await res.json()) as HuiWork[];
          setWorks(Array.isArray(rows) ? rows : []);
          setTotal(Array.isArray(rows) ? rows.length : 0);
        } else {
          setError(`HTTP ${res.status}`);
        }
      } else {
        const params: Record<string, string> = {};
        if (status && status !== 'all') params['status'] = `eq.${status}`;
        const [rows, count] = await Promise.all([
          sbQuery<HuiWork>('works', params, { select: '*', order: 'created_at.desc', limit }),
          sbCount('works', params),
        ]);
        setWorks(rows);
        setTotal(count);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  // ── Realtime-Subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!realtime) return;

    // Alten Channel aufräumen
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('admin:works')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'works' }, () => {
        // Daten bei jeder DB-Änderung sofort neu laden
        fetchWorks();
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchWorks]);

  // ── Initial fetch + Polling-Fallback ─────────────────────────────────
  useEffect(() => {
    fetchWorks();
    if (refreshInterval > 0) {
      const id = setInterval(fetchWorks, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchWorks, refreshInterval]);

  // ── updateStatus ─────────────────────────────────────────────────────
  const updateStatus = useCallback(async (
    id: string,
    newStatus: string,
    extra: Record<string, unknown> = {}
  ): Promise<boolean> => {
    // Optimistic update
    setWorks(prev => prev.map(w => w.id === id ? { ...w, status: newStatus, ...extra } : w));
    const ok = await sbUpdate('works', id, { status: newStatus, ...extra });
    if (!ok) fetchWorks(); // Rollback
    return ok;
  }, [fetchWorks]);

  return { works, total, loading, error, refetch: fetchWorks, updateStatus };
}
