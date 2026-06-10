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
  tagline: string | null;
  role: string;
  membership_type: string;
  is_wirker: boolean;
  is_member: boolean;
  membership_active: boolean;
  has_talent_profile: boolean;
  talent: string | null;
  location: string | null;
  location_label: string | null;
  is_available: boolean;
  availability: boolean;
  impact_eur: number;
  follower_count: number;
  followers_count: number;
  trust_score: number;
  is_guardian: boolean;
  blocked: boolean | null;
  blocked_at: string | null;
  blocked_by: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string | null;
  skills: string[] | null;
  focus_type: string | null;
  // Talent-Persistenz
  is_talent: boolean | null;
  talent_since: string | null;
  talent_activated_at: string | null;
  member_since: string | null;
  // Extended live-sync fields
  email: string | null;
  phone: string | null;
  full_name: string | null;
  last_seen_at: string | null;
  is_blocked: boolean;
  is_deleted: boolean;
  username_lower: string | null;
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
  creator_id: string | null;
  title: string;
  description: string | null;
  caption: string | null;
  category: string | null;
  work_category: string | null;
  tags: string[] | null;
  status: string;
  visibility: string | null;
  post_type: string | null;
  media_type: string | null;
  price: number | null;
  price_eur: number | null;
  sale_mode: string | null;
  for_sale: boolean;
  is_digital: boolean;
  is_showcase_only: boolean;
  stock_quantity: number | null;
  cover_url: string | null;
  images: unknown[] | null;
  media_url: string | null;
  media_urls: unknown | null;
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  shares_count: number;
  views_count: number;
  view_count: number;
  sale_count: number;
  allow_comments: boolean;
  allow_likes: boolean;
  allow_shares: boolean;
  location: string | null;
  location_text: string | null;
  location_label: string | null;
  language: string | null;
  file_format: string | null;
  shipping: boolean;
  shipping_available: boolean;
  shipping_countries: string | null;
  shipping_cost: number | null;
  pickup_available: boolean;
  delivery_time: string | null;
  duration: string | null;
  participant_limit: number | null;
  materials: string | null;
  size: string | null;
  condition: string | null;
  energy_level: string | null;
  mood_tags: string[] | null;
  social_energy: string | null;
  quantity: number;
  currency: string | null;
  experience_type: string | null;
  pricing_type: string | null;
  meeting_point: string | null;
  available_days: unknown | null;
  aspect_ratio: string | null;
  media_count: number;
  cover_index: number;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
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
  status?: 'all' | 'active' | 'blocked' | 'deleted';
  is_wirker?: boolean;
  page?: number;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { search, role, status = 'active', is_wirker, page = 0, limit = 50, refreshInterval = 0 } = opts;
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

      // Status-based filtering
      if (status === 'deleted') {
        params['trust_score'] = 'eq.-999';
      } else if (status === 'blocked') {
        params['role'] = 'eq.blocked';
        // remove any role filter override
      } else if (status === 'active') {
        params['trust_score'] = 'not.eq.-999';
        if (!params['role']) params['role'] = 'not.eq.blocked';
      } else {
        // 'all' — exclude only deleted
        params['trust_score'] = 'not.eq.-999';
      }

      const select = 'id,display_name,username,avatar_url,bio,tagline,role,membership_type,is_wirker,is_member,membership_active,has_talent_profile,talent,location,location_label,is_available,availability,impact_eur,follower_count,followers_count,trust_score,is_guardian,last_seen,last_seen_at,created_at,updated_at,skills,focus_type,email,phone,full_name,is_talent,talent_since,talent_activated_at,member_since,blocked,blocked_at,blocked_by';

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
      const q = (search || '').toLowerCase();
      const filtered = q
        ? rows.filter(
            (p) =>
              p.display_name?.toLowerCase().includes(q) ||
              p.full_name?.toLowerCase().includes(q) ||
              p.username?.toLowerCase().includes(q) ||
              p.email?.toLowerCase().includes(q) ||
              p.phone?.toLowerCase().includes(q) ||
              p.talent?.toLowerCase().includes(q)
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
  }, [search, role, status, is_wirker, page, limit]);

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

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    try {
      // flagged + deleted require service-role → use server-side API route
      const needsServiceRole = status === 'flagged' || status === 'deleted' || status === 'pending_review' || status === 'rejected';

      if (needsServiceRole) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (status) params.set('status', status);
        const res = await fetch(`/api/works?${params.toString()}`);
        if (res.ok) {
          const rows = await res.json() as HuiWork[];
          setWorks(Array.isArray(rows) ? rows : []);
          setTotal(Array.isArray(rows) ? rows.length : 0);
        }
      } else {
        const params: Record<string, string> = {};
        if (status && status !== 'all') params['status'] = `eq.${status}`;
        const [rows, count] = await Promise.all([
          sbQuery<HuiWork>('works', params, {
            select: '*',
            order: 'created_at.desc',
            limit,
          }),
          sbCount('works', params),
        ]);
        setWorks(rows);
        setTotal(count);
      }
    } catch (e) {
      console.error('[useWorks] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    fetchWorks();
    if (refreshInterval > 0) {
      const id = setInterval(fetchWorks, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchWorks, refreshInterval]);

  return { works, total, loading, refetch: fetchWorks };
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

// ── useExperiencesAndProjects ─────────────────────────────────────────────
export interface HuiEntry {
  id:                string;
  user_id:           string;
  title:             string;
  category:          string;
  description?:      string;
  price?:            number;
  status:            string;
  rejection_reason?: string;
  created_at:        string;
  updated_at?:       string;
  last_submitted_at?: string;
  _source:           'experiences' | 'projects';
}

export function useExperiencesAndProjects(opts: {
  status?: string;
  limit?: number;
  refreshInterval?: number;
} = {}) {
  const { status, limit = 500, refreshInterval = 0 } = opts;
  const [entries, setEntries] = useState<HuiEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/experiences?${params.toString()}`);
      if (res.ok) {
        const rows = await res.json() as HuiEntry[];
        const arr  = Array.isArray(rows) ? rows : [];
        setEntries(arr);
        setTotal(arr.length);
      }
    } catch (e) {
      console.error('[useExperiencesAndProjects] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    fetchEntries();
    if (refreshInterval > 0) {
      const id = setInterval(fetchEntries, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchEntries, refreshInterval]);

  return { entries, total, loading, refetch: fetchEntries };
}

