// frontend/src/lib/hooks/useDashboard.ts
// ── HUI Admin — useDashboard Hook ────────────────────────────────────────
// Lädt alle Dashboard-Daten in einem einzigen /api/dashboard Call.
// Kein direkter Supabase-Zugriff — alles über service_role Server-Route.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface DashboardKPIs {
  totalUsers:         number;
  activeWirker:       number;
  activeMembers:      number;
  totalWorks:         number;
  monthlyRevenue:     number;
  impactPool:         number;
  totalPayments:      number;
  activeBookings:     number;
  activeAmbassadors:  number;
  pendingAmbassadors: number;
  totalReferrals:     number;
}

export interface DashboardData {
  kpis:           DashboardKPIs;
  recentUsers:    Record<string, unknown>[];
  recentPayments: Record<string, unknown>[];
  impactProjects: Record<string, unknown>[];
  growth: {
    labels:      string[];
    newUsers:    number[];
    activeUsers: number[];
  };
  loading:  boolean;
  error:    string | null;
  refetch:  () => void;
  lastUpdated: Date | null;
}

const DEFAULT_KPIS: DashboardKPIs = {
  totalUsers: 0, activeWirker: 0, activeMembers: 0,
  totalWorks: 0, monthlyRevenue: 0, impactPool: 0,
  totalPayments: 0, activeBookings: 0, activeAmbassadors: 0,
  pendingAmbassadors: 0, totalReferrals: 0,
};

export function useDashboard(refreshInterval = 30000): DashboardData {
  const [data, setData] = useState<Omit<DashboardData, 'refetch'>>({
    kpis:           DEFAULT_KPIS,
    recentUsers:    [],
    recentPayments: [],
    impactProjects: [],
    growth:         { labels: [], newUsers: [], activeUsers: [] },
    loading:        true,
    error:          null,
    lastUpdated:    null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setData(prev => ({ ...prev, loading: false, error: j.error ?? `HTTP ${res.status}` }));
        return;
      }
      const json = await res.json();
      setData({
        kpis:           { ...DEFAULT_KPIS, ...json.kpis },
        recentUsers:    json.recentUsers    ?? [],
        recentPayments: json.recentPayments ?? [],
        impactProjects: json.impactProjects ?? [],
        growth:         json.growth ?? { labels: [], newUsers: [], activeUsers: [] },
        loading:        false,
        error:          null,
        lastUpdated:    new Date(),
      });
    } catch (e) {
      setData(prev => ({
        ...prev, loading: false,
        error: e instanceof Error ? e.message : 'Unbekannter Fehler',
      }));
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchAll, refreshInterval);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [fetchAll, refreshInterval]);

  return { ...data, refetch: fetchAll };
}
