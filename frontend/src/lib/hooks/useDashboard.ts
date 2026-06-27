// frontend/src/lib/hooks/useDashboard.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseRealtime } from './useSupabaseRealtime';

export interface KPIData {
  totalUsers:      number;
  activeWirker:    number;
  activeMembers:   number;
  monthlyRevenue:  number;
  netImpactPool:   number;
  companyShare:    number;
  totalWorks:      number;
  openBookings:    number;
  totalPayments:   number;
  activeAmbassadors: number;
  openApplications:  number;
  totalReferrals:    number;
  recentUsers:     Array<Record<string,unknown>>;
  recentPayments:  Array<Record<string,unknown>>;
  growthData:      Array<{ month: string; new: number; total: number }>;
  loading:   boolean;
  error:     string | null;
  lastUpdated: Date | null;
}

export interface DashboardData extends KPIData {
  refetch: () => void;
}

export function useDashboard(refreshInterval = 30000): DashboardData {
  const [data, setData] = useState<Omit<DashboardData, 'refetch'>>({
    totalUsers: 0, activeWirker: 0, activeMembers: 0,
    monthlyRevenue: 0, netImpactPool: 0, companyShare: 0,
    totalWorks: 0, openBookings: 0, totalPayments: 0,
    activeAmbassadors: 0, openApplications: 0, totalReferrals: 0,
    recentUsers: [], recentPayments: [], growthData: [],
    loading: true, error: null, lastUpdated: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setData(prev => ({ ...prev, loading: false, error: j.error ?? `HTTP ${res.status}` }));
        return;
      }
      const j = await res.json() as Omit<DashboardData, 'refetch'>;
      setData({ ...j, loading: false, error: null, lastUpdated: new Date() });
    } catch (e) {
      setData(prev => ({ ...prev, loading: false, error: String(e), lastUpdated: new Date() }));
    }
  }, []);

  // Initial + Poll
  useEffect(() => {
    fetchAll();
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchAll, refreshInterval);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, refreshInterval]);

  // Supabase Realtime: sofortiger Refresh bei jeder DB-Änderung
  useSupabaseRealtime({ onRefresh: fetchAll, debounceMs: 800 });

  return { ...data, refetch: fetchAll };
}
