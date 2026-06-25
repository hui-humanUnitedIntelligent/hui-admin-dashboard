// frontend/src/lib/hooks/useAmbassador.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSessionToken } from '@/lib/session';

export interface AmbassadorStats {
  activeAmbassadors:    number;
  pendingApplications:  number;
  totalReferrals:       number;
  totalRevenue:         number;
  netImpact:            number;
  levelDistribution:    Record<string, number>;
  loading:              boolean;
  error:                string | null;
}

const DEFAULT: AmbassadorStats = {
  activeAmbassadors: 0, pendingApplications: 0, totalReferrals: 0,
  totalRevenue: 0, netImpact: 0,
  levelDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
  loading: true, error: null,
};

export function useAmbassadorStats(refreshInterval = 60000): AmbassadorStats {
  const [stats, setStats] = useState<AmbassadorStats>(DEFAULT);

  const fetchStats = useCallback(async () => {
    try {
      const token = getSessionToken();
      const res = await fetch('/api/ambassador?action=stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Unterstütze beide Response-Shapes (camelCase aus neuer Route)
      const d = json.data ?? json;
      setStats({
        activeAmbassadors:   d.activeAmbassadors   ?? d.active_ambassadors   ?? 0,
        pendingApplications: d.pendingApplications ?? d.pending_applications ?? 0,
        totalReferrals:      d.totalReferrals       ?? d.total_referrals       ?? 0,
        totalRevenue:        d.totalRevenue         ?? d.total_revenue         ?? 0,
        netImpact:           d.netImpact            ?? d.net_impact            ?? 0,
        levelDistribution:   d.levelDistribution    ?? d.level_distribution    ?? { bronze: 0, silver: 0, gold: 0, platinum: 0 },
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
