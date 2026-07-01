// frontend/src/lib/hooks/useDashboard.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseRealtime } from './useSupabaseRealtime';

// Spiegelt exakt die API-Response wider
export interface BookingPeriodStat { count: number; revenue: number; }
export interface DashboardData {
  kpis: {
    totalUsers: number; activeWirker: number; activeMembers: number;
    totalWorks: number; monthlyRevenue: number; impactPool: number;
    projectShareEur: number; companyShareEur: number;
    totalPayments: number; activeBookings: number;
    activeAmbassadors: number; pendingAmbassadors: number; totalReferrals: number;
  };
  growth: { labels: string[]; newUsers: number[]; activeUsers: number[] };
  recentUsers:    Array<Record<string,unknown>>;
  recentPayments: Array<Record<string,unknown>>;
  impactProjects: Array<Record<string,unknown>>;
  bookingStats: { last7: BookingPeriodStat; last30: BookingPeriodStat; last90: BookingPeriodStat };
  talentStats:  { total: number; percentOfUsers: number };
  workStats:    { published: number; pending: number; rejected: number; deleted: number; total: number };
  projectStats: {
    applicationsPending: number; applicationsApproved: number; applicationsRejected: number;
    liveCount: number; totalVotes: number; totalAwardedEur: number;
  };
  pieData: {
    userComposition: { wirker: number; member: number; admin: number; basisuser: number };
    membershipTypes: { basisuser: number; talent: number; member: number };
    topCities: Array<{ label: string; count: number }>;
    bookingDistribution: { work: number; talent: number; project: number };
    purchaseDistribution: { work: number; talent: number; project: number; donation: number; subscription: number };
    impactDistribution: { work: number; talent: number; project: number; donation: number };
    ambassadorTiers: { bronze: number; silber: number; gold: number; platin: number };
    paymentStatusDistribution: { succeeded: number; pending: number; failed: number; refunded: number };
  };
  loading:     boolean;
  error:       string | null;
  lastUpdated: Date | null;
  refetch:     () => void;
}

const EMPTY: Omit<DashboardData, 'refetch'> = {
  kpis: {
    totalUsers:0, activeWirker:0, activeMembers:0,
    totalWorks:0, monthlyRevenue:0, impactPool:0,
    projectShareEur:0, companyShareEur:0,
    totalPayments:0, activeBookings:0,
    activeAmbassadors:0, pendingAmbassadors:0, totalReferrals:0,
  },
  growth:         { labels:[], newUsers:[], activeUsers:[] },
  recentUsers:    [],
  recentPayments: [],
  impactProjects: [],
  bookingStats: {
    last7:  { count: 0, revenue: 0 },
    last30: { count: 0, revenue: 0 },
    last90: { count: 0, revenue: 0 },
  },
  talentStats:  { total: 0, percentOfUsers: 0 },
  workStats:    { published: 0, pending: 0, rejected: 0, deleted: 0, total: 0 },
  projectStats: {
    applicationsPending: 0, applicationsApproved: 0, applicationsRejected: 0,
    liveCount: 0, totalVotes: 0, totalAwardedEur: 0,
  },
  pieData: {
    userComposition: { wirker: 0, member: 0, admin: 0, basisuser: 0 },
    membershipTypes: { basisuser: 0, talent: 0, member: 0 },
    topCities: [],
    bookingDistribution: { work: 0, talent: 0, project: 0 },
    purchaseDistribution: { work: 0, talent: 0, project: 0, donation: 0, subscription: 0 },
    impactDistribution: { work: 0, talent: 0, project: 0, donation: 0 },
    ambassadorTiers: { bronze: 0, silber: 0, gold: 0, platin: 0 },
    paymentStatusDistribution: { succeeded: 0, pending: 0, failed: 0, refunded: 0 },
  },
  loading: true, error: null, lastUpdated: null,
};

export function useDashboard(refreshInterval = 30000): DashboardData {
  const [data, setData] = useState<Omit<DashboardData,'refetch'>>(EMPTY);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { credentials:'include', cache:'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(()=>({})) as {error?:string};
        setData(p => ({...p, loading:false, error: j.error ?? `HTTP ${res.status}`}));
        return;
      }
      const j = await res.json() as Omit<DashboardData,'refetch'|'loading'|'error'|'lastUpdated'>;
      setData({
        kpis:           j.kpis           ?? EMPTY.kpis,
        growth:         j.growth         ?? EMPTY.growth,
        recentUsers:    j.recentUsers    ?? [],
        recentPayments: j.recentPayments ?? [],
        impactProjects: j.impactProjects ?? [],
        bookingStats:   j.bookingStats   ?? EMPTY.bookingStats,
        talentStats:    j.talentStats    ?? EMPTY.talentStats,
        workStats:      j.workStats      ?? EMPTY.workStats,
        projectStats:   j.projectStats   ?? EMPTY.projectStats,
        pieData:        j.pieData        ?? EMPTY.pieData,
        loading:     false,
        error:       null,
        lastUpdated: new Date(),
      });
    } catch(e) {
      setData(p => ({...p, loading:false, error:String(e)}));
    }
  }, []);

  // Initial + Polling
  useEffect(() => {
    fetchAll();
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchAll, refreshInterval);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, refreshInterval]);

  // Realtime: sofort bei DB-Änderung
  useSupabaseRealtime({ onRefresh: fetchAll, debounceMs: 800 });

  return { ...data, refetch: fetchAll };
}
