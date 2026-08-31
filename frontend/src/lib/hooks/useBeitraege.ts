// frontend/src/lib/hooks/useBeitraege.ts
// ── HUI Admin — useBeitraege Hook mit Realtime ───────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate } from '../api';

export interface HuiBeitrag {
  id:           string;
  user_id:      string;
  title:        string | null;
  content:      string | null;
  media_url:    string | null;
  media_type:   string | null;
  status:       string;
  category:     string | null;
  tags:         string[] | null;
  likes_count:  number;
  views_count:  number;
  created_at:   string;
  updated_at:   string | null;
}

export interface UseBeitraegeOptions {
  status?:          string;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export function useBeitraege(opts: UseBeitraegeOptions = {}) {
  const { status, limit = 50, refreshInterval = 0, realtime = true } = opts;
  const [beitraege, setBeitraege] = useState<HuiBeitrag[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const channelRef                = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchBeitraege = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;
      const [rows, count] = await Promise.all([
        sbQuery<HuiBeitrag>('beitraege', params, { select: '*', order: 'created_at.desc', limit }),
        sbCount('beitraege', params),
      ]);
      setBeitraege(rows); setTotal(count);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    if (!realtime) return;
    try {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel('admin:beitraege')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'beitraege' }, fetchBeitraege)
        .subscribe();
      channelRef.current = channel;
      return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
    } catch (e) {
      console.warn('[Realtime] useBeitraege channel setup failed:', e);
    }
  }, [realtime, fetchBeitraege]);

  useEffect(() => {
    fetchBeitraege();
    if (refreshInterval > 0) {
      const id = setInterval(fetchBeitraege, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchBeitraege, refreshInterval]);

  const updateStatus = useCallback(async (id: string, newStatus: string): Promise<boolean> => {
    setBeitraege(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    const ok = await sbUpdate('beitraege', id, { status: newStatus });
    if (!ok) fetchBeitraege();
    return ok;
  }, [fetchBeitraege]);

  return { beitraege, total, loading, error, refetch: fetchBeitraege, updateStatus };
}
