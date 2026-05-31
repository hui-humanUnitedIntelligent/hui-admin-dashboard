// frontend/src/lib/hooks/useAmbassador.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AmbassadorStats {
  active_ambassadors: number;
  pending_applications: number;
  total_referrals: number;
  total_revenue: number;
  net_impact: number;
  level_distribution: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const DEFAULT: AmbassadorStats = {
  active_ambassadors: 0, pending_applications: 0, total_referrals: 0,
  total_revenue: 0, net_impact: 0,
  level_distribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
  loading: true, error: null,
};

export function useAmbassadorStats(refreshInterval = 60000): AmbassadorStats {
  const [stats, setStats] = useState<AmbassadorStats>(DEFAULT);
  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador?action=stats');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setStats({ ...data, loading: false, error: null });
    } catch (e) {
      setStats(prev => ({ ...prev, loading: false, error: String(e) }));
    }
  }, []);
  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, refreshInterval);
    return () => clearInterval(t);
  }, [fetch_, refreshInterval]);
  return stats;
}
