// frontend/src/lib/hooks/useImpact.ts
// ── HUI Admin — useImpact Hook mit Realtime ──────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbUpdate } from '../api';
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
      const rows = await sbQuery<HuiImpactProject>('impact_projects', {}, {
        select: 'id,name,category,description,icon,color,votes,status,goal_eur,awarded_eur,month',
        order:  'votes.desc',
        limit:  100,
      });
      setProjects(rows);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('admin:impact')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impact_projects' }, fetchImpact)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impact_votes'    }, fetchImpact)
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchImpact]);

  useEffect(() => {
    fetchImpact();
    if (refreshInterval > 0) {
      const id = setInterval(fetchImpact, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchImpact, refreshInterval]);

  const updateProject = useCallback(async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    const ok = await sbUpdate('impact_projects', id, data);
    if (ok) fetchImpact();
    return ok;
  }, [fetchImpact]);

  return { projects, loading, error, refetch: fetchImpact, updateProject };
}

// Backward-compat alias
export const useImpactProjects = useImpact;
