// frontend/src/lib/hooks/usePendingCounts.ts
// BADGE-SYNC-001: Zähler für alle Content-Bereiche
// Strategie: 30s Polling als Basis + Supabase Realtime für sofortige Updates
// Tabellen: works, talents, experiences → reagieren jeweils auf INSERT/UPDATE/DELETE
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

export type PendingCounts = {
  works:       number;
  talents:     number;
  experiences: number;
  total:       number;
};

const EMPTY: PendingCounts = { works: 0, talents: 0, experiences: 0, total: 0 };

// Supabase Client für Realtime (anon key reicht — wir hören nur auf Schema-Events)
function getRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function usePendingCounts(intervalMs = 30_000) {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/pending-counts', { cache: 'no-store' });
      if (r.ok) setCounts(await r.json());
    } catch { /* silently ignore network errors */ }
  }, []);

  // ── Polling (Fallback + erster Load) ──────────────────────────────────
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  // ── Realtime: sofortige Badge-Aktualisierung bei DB-Änderung ──────────
  useEffect(() => {
    const sb = getRealtimeClient();
    if (!sb) return;

    // Channel auf alle drei Tabellen hören
    const channel = sb
      .channel('pending-counts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'works' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'talents' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'experiences' },
        () => refresh()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      sb.removeChannel(channel);
    };
  }, [refresh]);

  return counts;
}
