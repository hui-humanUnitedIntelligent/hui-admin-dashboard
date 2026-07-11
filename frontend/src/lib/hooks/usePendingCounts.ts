// frontend/src/lib/hooks/usePendingCounts.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export type PendingCounts = {
  works:       number;
  talents:     number;
  experiences: number;
  total:       number;
};

const EMPTY: PendingCounts = { works: 0, talents: 0, experiences: 0, total: 0 };

export function usePendingCounts(intervalMs = 30_000) {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/pending-counts');
      if (r.ok) setCounts(await r.json());
    } catch { /* silently ignore network errors */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return counts;
}
