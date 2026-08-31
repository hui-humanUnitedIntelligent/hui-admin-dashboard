// frontend/src/lib/hooks/useExperiences.ts
// ── HUI Admin — useExperiences Hook mit Realtime ─────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import type { HuiEntry } from './useSupabase';

export type { HuiEntry };

export interface UseExperiencesOptions {
  status?:          string;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export interface UseExperiencesReturn {
  entries:      HuiEntry[];
  total:        number;
  loading:      boolean;
  error:        string | null;
  refetch:      () => void;
  updateStatus: (id: string, status: string, table?: 'experiences' | 'projects') => Promise<boolean>;
}

export function useExperiences(opts: UseExperiencesOptions = {}): UseExperiencesReturn {
  const { status, limit = 500, refreshInterval = 0, realtime = true } = opts;
  const [entries, setEntries] = useState<HuiEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const channelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch via /api/experiences (Service Role) ────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getSessionToken } = await import('@/lib/session');
      const params = new URLSearchParams({ limit: String(limit) });
      // Nur filtern wenn explizit gesetzt (nicht 'all')
      if (status && status !== 'all') params.set('status', status);
      const res = await fetch(`/api/experiences?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // API gibt Array direkt zurück (kein ok()-wrapper)
      // Support beides: 'entries' (neue Route) und 'experiences' (alte Route)
      const arr = Array.isArray(json.entries) ? json.entries : Array.isArray(json.experiences) ? json.experiences : Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
      setEntries(arr);
      setTotal(json.total ?? arr.length);
    } catch (e: unknown) {
      setError((e as Error).message);
      console.error('[useExperiences]', e);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  // ── Realtime-Subscription (experiences + projects) ───────────────────
  useEffect(() => {
    if (!realtime) return;
    try {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const channel = supabase
        .channel('admin:experiences')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'experiences' }, fetchEntries)
        // .on('postgres_changes', { event: '*', schema: 'public', table: 'projects'    }, fetchEntries) // table does not exist
        .subscribe();

      channelRef.current = channel;
      return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
    } catch (e) {
      console.warn('[Realtime] useExperiences channel setup failed:', e);
    }
  }, [realtime, fetchEntries]);

  // ── Initial fetch + Polling-Fallback ─────────────────────────────────
  useEffect(() => {
    fetchEntries();
    if (refreshInterval > 0) {
      const id = setInterval(fetchEntries, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchEntries, refreshInterval]);

  // ── updateStatus (via /api/admin) ────────────────────────────────────
  const updateStatus = useCallback(async (
    id: string,
    newStatus: string,
    table: 'experiences' | 'projects' = 'experiences'
  ): Promise<boolean> => {
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === id ? { ...e, approval_status: newStatus } : e));
    try {
      const endpoint = table === 'projects' ? '/api/impact' : '/api/experiences';
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, type: table === 'projects' ? 'projects' : undefined }),
      });
      if (!res.ok) { fetchEntries(); return false; }
      return true;
    } catch {
      fetchEntries();
      return false;
    }
  }, [fetchEntries]);

  return { entries, total, loading, error, refetch: fetchEntries, updateStatus };
}

// Backward-compat alias
export const useExperiencesAndProjects = useExperiences;
