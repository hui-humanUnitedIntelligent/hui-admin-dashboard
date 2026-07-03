// frontend/src/lib/hooks/useAmbassador.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

// Interface hält snake_case für Backwards-Kompatibilität mit bestehenden Pages
export interface AmbassadorStats {
  active_ambassadors:   number;
  pending_applications: number;
  total_referrals:      number;
  total_revenue:        number;
  net_impact:           number;
  level_distribution:   Record<string, number>;
  loading:              boolean;
  error:                string | null;
}

const DEFAULT: AmbassadorStats = {
  active_ambassadors: 0, pending_applications: 0, total_referrals: 0,
  total_revenue: 0, net_impact: 0,
  level_distribution: { starter: 0, bronze: 0, silver: 0, gold: 0 }, // COM-MIGRATION-015.3
  loading: true, error: null,
};

export function useAmbassadorStats(refreshInterval = 60000): AmbassadorStats {
  const [stats, setStats] = useState<AmbassadorStats>(DEFAULT);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/ambassador?action=stats', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Normalisiere: API gibt camelCase → wir mappen auf snake_case Interface
      const d = json.data ?? json;
      setStats({
        active_ambassadors:   d.activeAmbassadors   ?? d.active_ambassadors   ?? 0,
        pending_applications: d.pendingApplications ?? d.pending_applications ?? 0,
        total_referrals:      d.totalReferrals       ?? d.total_referrals       ?? 0,
        total_revenue:        d.totalRevenue         ?? d.total_revenue         ?? 0,
        net_impact:           d.netImpact            ?? d.net_impact            ?? 0,
        level_distribution:   d.levelDistribution    ?? d.level_distribution    ?? { starter: 0, bronze: 0, silver: 0, gold: 0 }, // COM-MIGRATION-015.3
        loading: false, error: null,
      });
    } catch (e) {
      setStats(prev => ({ ...prev, loading: false, error: String(e) }));
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(t);
  }, [fetchStats, refreshInterval]);

  return stats;
}
