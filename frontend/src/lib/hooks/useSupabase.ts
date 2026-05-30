// frontend/src/lib/hooks/useSupabase.ts
// ── Core Supabase Live-Data Hooks ─────────────────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { sbQuery, sbCount, sbUpdate, sbDelete, SUPABASE_URL, SUPABASE_ANON, SUPABASE_SERVICE } from '../api';

// ── Types ─────────────────────────────────────────────────────────────────
export interface HuiProfile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  membership_type: string;
  is_wirker: boolean;
  has_talent_profile: boolean;
  talent: string | null;
  location: string | null;
  is_available: boolean;
  impact_eur: number;
  followers_count: number;
  created_at: string;
}

export interface HuiPayment {
  id: string;
  payer_id: string | null;
  recipient_id: string | null;
  amount_eur: number;
  impact_amount: number;
  status: string;
  currency: string;
  created_at: string;
  booking_id: string | null;
}

export interface HuiWork {
  id: string;
  user_id: string;
  title: string;
  category: string | null;
  status: string;
  price: number | null;
  likes_count: number;
  views_count: number;
  created_at: string;
}

export interface HuiImpactProject {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  votes: number;
  status: string;
  goal_eur: number | null;
  awarded_eur: number | null;
  month: string | null;
}

export interface HuiBooking {
  id: string;
  user_id: string;
  wirker_id: string;
  amount: number;
  platform_fee: number;
  impact_fee: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface HuiMembership {
  id: string;
  user_id: string;
  membership_type: string;
  status: string;
  vote_weight: number;
  started_at: string;
  expires_at: string | null;
}

// ── useKPIs ───────────────────────────────────────────────────────────────
export function useKPIs(refreshInterval = 30000) {
  const [kpis, setKpis] = useState({
    totalUsers: 0,
    activeWirker: 0,
    totalPayments: 0,
    monthlyRevenue: 0,
    impactPool: 0,
    activeBookings: 0,
    totalWorks: 0,
    activeMembers: 0,
    loading: true,
    error: null as string | null,
    lastUpdated: null as Date | null,
  });

  const fetch = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        totalUsers,
        activeWirker,
        totalWorks,
        activeMembers,
      ] = await Promise.all([
        sbCount('profiles'),
        sbCount('profiles', { 'is_wirker': 'eq.true' }),
        sbCount('works', { 'status': 'eq.published' }),
        sbCount('memberships', { 'status': 'eq.active' }),
      ]);

      // Payments this month
      let monthlyRevenue = 0;
      let impactPool = 0;
      let totalPayments = 0;
      let activeBookings = 0;

      try {
        const payments = await sbQuery<HuiPayment>('payments', {
          'created_at': `gte.${startOfMonth}`,
          'status': 'eq.completed',
        }, { select: 'amount_eur,impact_amount', limit: 500 });
        monthlyRevenue = payments.reduce((s, p) => s + (p.amount_eur || 0), 0);
        impactPool = payments.reduce((s, p) => s + (p.impact_amount || 0), 0);

        const allPayments = await sbQuery<HuiPayment>('payments', {}, { select: 'id', limit: 1 });
        totalPayments = allPayments.length;
      } catch {}

      try {
        const bookings = await sbQuery<HuiBooking>('bookings', { 'status': 'eq.confirmed' }, { select: 'id', limit: 1 });
        activeBookings = bookings.length;
      } catch {}

      setKpis({
        totalUsers,
        activeWirker,
        totalPayments,
        monthlyRevenue,
        impactPool,
        activeBookings,
        totalWorks,
        activeMembers,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (e: unknown) {
      setKpis((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, refreshInterval);
    return () => clearInterval(id);
  }, [fetch, refreshInterval]);

  return { ...kpis, refetch: fetch };
}

// ── useProfiles (User Management) ─────────────────────────────────────────
export function useProfiles(opts: {
  search?: string;
  role?: string;
  is_wirker?: boolean;
  page?: number;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { search, role, is_wirker, page = 0, limit = 50, refreshInterval = 0 } = opts;
  const [profiles, setProfiles] = useState<HuiProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (role && role !== 'all') params['role'] = `eq.${role}`;
      if (is_wirker !== undefined) params['is_wirker'] = `eq.${is_wirker}`;

      const select = 'id,display_name,username,avatar_url,role,membership_type,is_wirker,has_talent_profile,talent,location,is_available,impact_eur,followers_count,created_at';

      const [rows, count] = await Promise.all([
        sbQuery<HuiProfile>('profiles', params, {
          select,
          order: 'created_at.desc',
          limit,
          offset: page * limit,
        }),
        sbCount('profiles', params),
      ]);

      // Client-side search filter
      const filtered = search
        ? rows.filter(
            (p) =>
              p.display_name?.toLowerCase().includes(search.toLowerCase()) ||
              p.username?.toLowerCase().includes(search.toLowerCase()) ||
              p.talent?.toLowerCase().includes(search.toLowerCase())
          )
        : rows;

      setProfiles(filtered);
      setTotal(count);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, role, is_wirker, page, limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  const updateProfile = useCallback(async (id: string, data: Record<string, unknown>) => {
    const ok = await sbUpdate('profiles', id, data);
    if (ok) fetch();
    return ok;
  }, [fetch]);

  return { profiles, total, loading, error, refetch: fetch, updateProfile };
}

// ── usePayments (Transactions) ────────────────────────────────────────────
export function usePayments(opts: {
  status?: string;
  days?: number;
  page?: number;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { status, days, page = 0, limit = 50, refreshInterval = 0 } = opts;
  const [payments, setPayments] = useState<HuiPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;
      if (days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        params['created_at'] = `gte.${cutoff.toISOString()}`;
      }

      const [rows, count] = await Promise.all([
        sbQuery<HuiPayment>('payments', params, {
          select: 'id,payer_id,recipient_id,amount_eur,impact_amount,status,currency,created_at,booking_id',
          order: 'created_at.desc',
          limit,
          offset: page * limit,
        }),
        sbCount('payments', params),
      ]);

      setPayments(rows);
      setTotal(count);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, days, page, limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  return { payments, total, loading, error, refetch: fetch };
}

// ── useImpactProjects ─────────────────────────────────────────────────────
export function useImpactProjects(refreshInterval = 0) {
  const [projects, setProjects] = useState<HuiImpactProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await sbQuery<HuiImpactProject>('impact_projects', {}, {
        select: 'id,name,category,description,icon,color,votes,status,goal_eur,awarded_eur,month',
        order: 'votes.desc',
        limit: 50,
      });
      setProjects(rows);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  return { projects, loading, error, refetch: fetch };
}

// ── useWorks ──────────────────────────────────────────────────────────────
export function useWorks(opts: {
  status?: string;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { status, limit = 50, refreshInterval = 0 } = opts;
  const [works, setWorks] = useState<HuiWork[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;

      const [rows, count] = await Promise.all([
        sbQuery<HuiWork>('works', params, {
          select: 'id,user_id,title,category,status,price,likes_count,views_count,created_at',
          order: 'created_at.desc',
          limit,
        }),
        sbCount('works', params),
      ]);
      setWorks(rows);
      setTotal(count);
    } catch {}
    finally { setLoading(false); }
  }, [status, limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  return { works, total, loading, refetch: fetch };
}

// ── useGrowthChart ────────────────────────────────────────────────────────
export function useGrowthChart() {
  const [data, setData] = useState<{ labels: string[]; newUsers: number[]; activeUsers: number[] }>({
    labels: [],
    newUsers: [],
    activeUsers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Build last 12 months
        const months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - (11 - i));
          return {
            label: d.toLocaleString('de-DE', { month: 'short' }),
            start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
            end:   new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
          };
        });

        const results = await Promise.all(
          months.map(async ({ start, end }) => {
            const [newU, activeU] = await Promise.all([
              sbCount('profiles', { 'created_at': `gte.${start}`, 'created_at2': `lt.${end}` }),
              sbCount('profiles', {}), // simplified for now
            ]);
            return { newU };
          })
        );

        setData({
          labels: months.map((m) => m.label),
          newUsers: results.map((r) => r.newU),
          activeUsers: results.map((_, i) => Math.max(0, results.slice(0, i + 1).reduce((s, r) => s + r.newU, 0))),
        });
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return { ...data, loading };
}

// ── useBookings ───────────────────────────────────────────────────────────
export function useBookings(opts: {
  status?: string;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { status, limit = 50, refreshInterval = 0 } = opts;
  const [bookings, setBookings] = useState<HuiBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;

      const [rows, count] = await Promise.all([
        sbQuery<HuiBooking>('bookings', params, {
          select: 'id,user_id,wirker_id,amount,platform_fee,impact_fee,status,payment_status,created_at',
          order: 'created_at.desc',
          limit,
        }),
        sbCount('bookings', params),
      ]);
      setBookings(rows);
      setTotal(count);
    } catch {}
    finally { setLoading(false); }
  }, [status, limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  return { bookings, total, loading, refetch: fetch };
}

// ── useMemberships ────────────────────────────────────────────────────────
export function useMemberships(opts: { limit?: number; refreshInterval?: number } = {}) {
  const { limit = 100, refreshInterval = 0 } = opts;
  const [memberships, setMemberships] = useState<HuiMembership[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, count] = await Promise.all([
        sbQuery<HuiMembership>('memberships', { 'status': 'eq.active' }, {
          select: 'id,user_id,membership_type,status,vote_weight,started_at,expires_at',
          order: 'started_at.desc',
          limit,
        }),
        sbCount('memberships', { 'status': 'eq.active' }),
      ]);
      setMemberships(rows);
      setTotal(count);
    } catch {}
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) {
      const id = setInterval(fetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetch, refreshInterval]);

  return { memberships, total, loading, refetch: fetch };
}

// ── useSystemHealth ───────────────────────────────────────────────────────
export function useSystemHealth(refreshInterval = 30000) {
  const [health, setHealth] = useState({
    supabase: 'unknown' as 'ok' | 'error' | 'unknown',
    latency: 0,
    loading: true,
  });

  const check = useCallback(async () => {
    const start = Date.now();
    try {
      const rows = await sbQuery<{ id: string }>('profiles', {}, { select: 'id', limit: 1 });
      setHealth({
        supabase: 'ok',
        latency: Date.now() - start,
        loading: false,
      });
    } catch {
      setHealth({ supabase: 'error', latency: Date.now() - start, loading: false });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, refreshInterval);
    return () => clearInterval(id);
  }, [check, refreshInterval]);

  return health;
}
