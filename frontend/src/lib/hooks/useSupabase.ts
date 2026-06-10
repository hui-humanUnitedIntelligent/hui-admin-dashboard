// frontend/src/lib/hooks/useSupabase.ts
// ── HUI Admin — Core Supabase Hooks (v2 — mit Realtime) ──────────────────
// MIGRATION: Alle bestehenden Exports bleiben exakt erhalten.
// Intern nutzen die Hooks jetzt den zentralen supabase-Client + Realtime.
// Seiten müssen NICHT geändert werden.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate, sbDelete } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — unverändert, alle re-exportiert
// ─────────────────────────────────────────────────────────────────────────────
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
  is_talent: boolean | null;
  talent_since: string | null;
  talent_activated_at: string | null;
  member_since: string | null;
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
  approval_status?: string | null;
  rejection_reason?: string | null;
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

export interface HuiEntry {
  id:                string;
  user_id:           string;
  title:             string;
  category:          string;
  description?:      string;
  price?:            number | null;
  status:            string;
  approval_status?:  string | null;
  rejection_reason?: string | null;
  created_at:        string;
  updated_at?:       string | null;
  last_submitted_at?: string | null;
  _source:           'experiences' | 'projects';
  [key: string]:     unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime-Helper — Channel erzeugen + auto-cleanup
// ─────────────────────────────────────────────────────────────────────────────
type ChannelRef = ReturnType<typeof supabase.channel> | null;

function useRealtimeTable(
  channelId: string,
  tables: string[],
  onEvent: () => void,
  enabled = true
) {
  const ref = useRef<ChannelRef>(null);
  useEffect(() => {
    if (!enabled) return;
    if (ref.current) supabase.removeChannel(ref.current);

    let ch = supabase.channel(channelId);
    for (const table of tables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, onEvent);
    }
    ch.subscribe();
    ref.current = ch;
    return () => { if (ref.current) supabase.removeChannel(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, enabled]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useKPIs
// ─────────────────────────────────────────────────────────────────────────────
export function useKPIs(refreshInterval = 0) {
  const [kpis, setKpis] = useState({
    totalUsers: 0, activeWirker: 0, totalPayments: 0,
    monthlyRevenue: 0, impactPool: 0, activeBookings: 0,
    totalWorks: 0, activeMembers: 0,
    loading: true, error: null as string | null, lastUpdated: null as Date | null,
  });

  const fetch = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [totalUsers, activeWirker, totalWorks, activeMembers] = await Promise.all([
        sbCount('profiles'),
        sbCount('profiles', { 'is_wirker': 'eq.true' }),
        sbCount('works', { 'status': 'eq.published' }),
        sbCount('memberships', { 'status': 'eq.active' }),
      ]);
      let monthlyRevenue = 0, impactPool = 0, totalPayments = 0, activeBookings = 0;
      try {
        const payments = await sbQuery<HuiPayment>('payments', {
          'created_at': `gte.${startOfMonth}`, 'status': 'eq.completed',
        }, { select: 'amount_eur,impact_amount', limit: 500 });
        monthlyRevenue = payments.reduce((s, p) => s + (p.amount_eur || 0), 0);
        impactPool     = payments.reduce((s, p) => s + (p.impact_amount || 0), 0);
        totalPayments  = await sbCount('payments');
      } catch { /* non-critical */ }
      try {
        activeBookings = await sbCount('bookings', { 'status': 'eq.confirmed' });
      } catch { /* non-critical */ }
      setKpis({ totalUsers, activeWirker, totalPayments, monthlyRevenue, impactPool,
        activeBookings, totalWorks, activeMembers, loading: false, error: null, lastUpdated: new Date() });
    } catch (e: unknown) {
      setKpis(prev => ({ ...prev, loading: false, error: (e as Error).message }));
    }
  }, []);

  // Realtime: KPIs neu laden wenn sich profiles/works/payments/bookings ändern
  useRealtimeTable('kpis:realtime', ['profiles', 'works', 'payments', 'bookings'], fetch);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, refreshInterval > 0 ? refreshInterval : 60000);
    return () => clearInterval(id);
  }, [fetch, refreshInterval]);

  return { ...kpis, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useProfiles
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE_SELECT = [
  'id,display_name,username,avatar_url,bio,tagline,role,membership_type',
  'is_wirker,is_member,membership_active,has_talent_profile,talent',
  'location,location_label,is_available,availability,impact_eur',
  'follower_count,followers_count,trust_score,is_guardian',
  'last_seen,last_seen_at,created_at,updated_at,skills,focus_type',
  'email,phone,full_name,is_talent,talent_since,talent_activated_at',
  'member_since,blocked,blocked_at,blocked_by,is_blocked,is_deleted,username_lower',
].join(',');

export function useProfiles(opts: {
  search?: string; role?: string; status?: 'all' | 'active' | 'blocked' | 'deleted';
  is_wirker?: boolean; page?: number; limit?: number; refreshInterval?: number;
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
      if      (status === 'deleted') { params['trust_score'] = 'eq.-999'; }
      else if (status === 'blocked') { params['role'] = 'eq.blocked'; }
      else if (status === 'active')  { params['trust_score'] = 'not.eq.-999'; if (!params['role']) params['role'] = 'not.eq.blocked'; }
      else                           { params['trust_score'] = 'not.eq.-999'; }

      const [rows, count] = await Promise.all([
        sbQuery<HuiProfile>('profiles', params, { select: PROFILE_SELECT, order: 'created_at.desc', limit, offset: page * limit }),
        sbCount('profiles', params),
      ]);
      const q = (search || '').toLowerCase();
      const filtered = q
        ? rows.filter(p =>
            p.display_name?.toLowerCase().includes(q) || p.full_name?.toLowerCase().includes(q) ||
            p.username?.toLowerCase().includes(q)     || p.email?.toLowerCase().includes(q)     ||
            p.phone?.toLowerCase().includes(q)        || p.talent?.toLowerCase().includes(q))
        : rows;
      setProfiles(filtered); setTotal(count); setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [search, role, status, is_wirker, page, limit]);

  useRealtimeTable('profiles:realtime', ['profiles', 'wirker_profiles'], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  const updateProfile = useCallback(async (id: string, data: Record<string, unknown>) => {
    const ok = await sbUpdate('profiles', id, data);
    if (ok) fetch();
    return ok;
  }, [fetch]);

  return { profiles, total, loading, error, refetch: fetch, updateProfile };
}

// ─────────────────────────────────────────────────────────────────────────────
// usePayments
// ─────────────────────────────────────────────────────────────────────────────
export function usePayments(opts: {
  status?: string; days?: number; page?: number; limit?: number; refreshInterval?: number;
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
      if (days) { const c = new Date(); c.setDate(c.getDate() - days); params['created_at'] = `gte.${c.toISOString()}`; }
      const [rows, count] = await Promise.all([
        sbQuery<HuiPayment>('payments', params, {
          select: 'id,payer_id,recipient_id,amount_eur,impact_amount,status,currency,created_at,booking_id',
          order: 'created_at.desc', limit, offset: page * limit }),
        sbCount('payments', params),
      ]);
      setPayments(rows); setTotal(count); setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [status, days, page, limit]);

  useRealtimeTable('payments:realtime', ['payments', 'orders'], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { payments, total, loading, error, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useImpactProjects
// ─────────────────────────────────────────────────────────────────────────────
export function useImpactProjects(refreshInterval = 0) {
  const [projects, setProjects] = useState<HuiImpactProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await sbQuery<HuiImpactProject>('impact_projects', {}, {
        select: 'id,name,category,description,icon,color,votes,status,goal_eur,awarded_eur,month',
        order: 'votes.desc', limit: 50,
      });
      setProjects(rows); setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, []);

  useRealtimeTable('impact:realtime', ['impact_projects', 'impact_votes'], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { projects, loading, error, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useWorks — mit Realtime
// ─────────────────────────────────────────────────────────────────────────────
export function useWorks(opts: {
  status?: string; limit?: number; refreshInterval?: number;
} = {}) {
  const { status, limit = 50, refreshInterval = 0 } = opts;
  const [works, setWorks] = useState<HuiWork[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const needsServiceRole = ['flagged','deleted','pending_review','rejected','pending'].includes(status || '');
      if (needsServiceRole) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (status) params.set('status', status);
        const res = await window.fetch(`/api/works?${params}`);
        if (res.ok) {
          const rows = await res.json() as HuiWork[];
          setWorks(Array.isArray(rows) ? rows : []);
          setTotal(Array.isArray(rows) ? rows.length : 0);
        }
      } else {
        const params: Record<string, string> = {};
        if (status && status !== 'all') params['status'] = `eq.${status}`;
        const [rows, count] = await Promise.all([
          sbQuery<HuiWork>('works', params, { select: '*', order: 'created_at.desc', limit }),
          sbCount('works', params),
        ]);
        setWorks(rows); setTotal(count);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
      console.error('[useWorks]', e);
    } finally { setLoading(false); }
  }, [status, limit]);

  useRealtimeTable('works:realtime', ['works'], fetchWorks);

  useEffect(() => {
    fetchWorks();
    if (refreshInterval > 0) { const id = setInterval(fetchWorks, refreshInterval); return () => clearInterval(id); }
  }, [fetchWorks, refreshInterval]);

  return { works, total, loading, error, refetch: fetchWorks };
}

// ─────────────────────────────────────────────────────────────────────────────
// useGrowthChart — unverändert
// ─────────────────────────────────────────────────────────────────────────────
export function useGrowthChart() {
  const [data, setData] = useState<{ labels: string[]; newUsers: number[]; activeUsers: number[] }>({
    labels: [], newUsers: [], activeUsers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - (11 - i));
          return {
            label: d.toLocaleString('de-DE', { month: 'short' }),
            start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
          };
        });
        const results = await Promise.all(
          months.map(({ start }) => sbCount('profiles', { 'created_at': `gte.${start}` }))
        );
        setData({
          labels:      months.map(m => m.label),
          newUsers:    results,
          activeUsers: results.map((_, i) => results.slice(0, i + 1).reduce((s, v) => s + v, 0)),
        });
      } catch { /* non-critical */ }
      finally { setLoading(false); }
    })();
  }, []);

  return { ...data, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// useBookings — mit Realtime
// ─────────────────────────────────────────────────────────────────────────────
export function useBookings(opts: {
  status?: string; limit?: number; refreshInterval?: number;
} = {}) {
  const { status, limit = 50, refreshInterval = 0 } = opts;
  const [bookings, setBookings] = useState<HuiBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;
      const [rows, count] = await Promise.all([
        sbQuery<HuiBooking>('bookings', params, {
          select: 'id,user_id,wirker_id,amount,platform_fee,impact_fee,status,payment_status,created_at',
          order: 'created_at.desc', limit }),
        sbCount('bookings', params),
      ]);
      setBookings(rows); setTotal(count);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [status, limit]);

  useRealtimeTable('bookings:realtime', ['bookings'], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { bookings, total, loading, error, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useMemberships — unverändert
// ─────────────────────────────────────────────────────────────────────────────
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
          order: 'started_at.desc', limit }),
        sbCount('memberships', { 'status': 'eq.active' }),
      ]);
      setMemberships(rows); setTotal(count);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { memberships, total, loading, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSystemHealth — mit Latenz-Check
// ─────────────────────────────────────────────────────────────────────────────
export function useSystemHealth(refreshInterval = 0) {
  const [health, setHealth] = useState({
    supabase: 'unknown' as 'ok' | 'error' | 'unknown',
    latency: 0, loading: true,
  });

  const check = useCallback(async () => {
    const start = Date.now();
    try {
      await sbQuery<{ id: string }>('profiles', {}, { select: 'id', limit: 1 });
      setHealth({ supabase: 'ok', latency: Date.now() - start, loading: false });
    } catch {
      setHealth({ supabase: 'error', latency: Date.now() - start, loading: false });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, refreshInterval > 0 ? refreshInterval : 30000);
    return () => clearInterval(id);
  }, [check, refreshInterval]);

  return health;
}

// ─────────────────────────────────────────────────────────────────────────────
// useExperiencesAndProjects — mit Realtime
// ─────────────────────────────────────────────────────────────────────────────
export function useExperiencesAndProjects(opts: {
  status?: string; limit?: number; refreshInterval?: number;
} = {}) {
  const { status, limit = 500, refreshInterval = 0 } = opts;
  const [entries, setEntries] = useState<HuiEntry[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.set('status', status);
      const res = await window.fetch(`/api/experiences?${params}`);
      if (res.ok) {
        const rows = await res.json() as HuiEntry[];
        const arr  = Array.isArray(rows) ? rows : [];
        setEntries(arr); setTotal(arr.length);
      } else {
        setError(`HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [status, limit]);

  useRealtimeTable('experiences:realtime', ['experiences', 'projects'], fetchEntries);

  useEffect(() => {
    fetchEntries();
    if (refreshInterval > 0) { const id = setInterval(fetchEntries, refreshInterval); return () => clearInterval(id); }
  }, [fetchEntries, refreshInterval]);

  return { entries, total, loading, error, refetch: fetchEntries };
}
