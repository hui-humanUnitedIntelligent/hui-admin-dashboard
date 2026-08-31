// frontend/src/lib/hooks/useImpact.ts
// ── HUI Admin — useImpact Hook mit Realtime ──────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import type { HuiImpactProject } from './useSupabase';

export type { HuiImpactProject };

export interface UseImpactOptions {
  refreshInterval?: number;
  realtime?:        boolean;
}

export function useImpact(opts: UseImpactOptions = {}) {
  const { refreshInterval = 0, realtime = true } = opts;
  const [projects, setProjects] = useState<HuiImpactProject[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const channelRef              = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchImpact = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/impact?type=projects&limit=200', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json.projects) ? json.projects : [];
      setProjects(rows as HuiImpactProject[]);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime-Subscription
  useEffect(() => {
    if (!realtime) return;
    try {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel('admin:impact')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impact_projects' }, fetchImpact)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impact_votes'    }, fetchImpact)
        .subscribe();
      channelRef.current = channel;
      return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
    } catch (e) {
      console.warn('[Realtime] useImpact channel setup failed:', e);
    }
  }, [realtime, fetchImpact]);

  // Initialer Load + Interval
  useEffect(() => {
    fetchImpact();
    if (refreshInterval > 0) {
      const id = setInterval(fetchImpact, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchImpact, refreshInterval]);

  // updateProject → über Server-API (nicht direkt via Client)
  const updateProject = useCallback(async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/impact-applications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) fetchImpact();
      return res.ok;
    } catch {
      return false;
    }
  }, [fetchImpact]);

  return { projects, loading, error, refetch: fetchImpact, updateProject };
}

// Backward-compat alias
export const useImpactProjects = useImpact;
