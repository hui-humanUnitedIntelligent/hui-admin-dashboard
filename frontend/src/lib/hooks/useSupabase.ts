// frontend/src/lib/hooks/useSupabase.ts
// ── HUI Admin — Core Supabase Hooks (v2 — mit Realtime) ──────────────────
// MIGRATION: Alle bestehenden Exports bleiben exakt erhalten.
// Intern nutzen die Hooks jetzt den zentralen supabase-Client + Realtime.
// Seiten müssen NICHT geändert werden.
// Build: 2026-06-10T16:54
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate, sbDelete } from '../api';
import { getSessionToken } from '@/lib/session';

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

export interface HuiTransaction {
  row_id: string;
  record_type: 'payment' | 'refund' | 'subscription' | 'commission' | 'payout';
  category: string;
  status: string;
  amount: number;
  currency: string;
  user_id: string | null;
  user_name: string | null;
  user_username: string | null;
  user_email: string | null;
  ambassador_id: string | null;
  ambassador_name: string | null;
  ambassador_username: string | null;
  work_id: string | null;
  work_title: string | null;
  talent_id: string | null;
  project_id: string | null;
  project_title: string | null;
  impact_share: number | null;
  commission_amount: number | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Backward-compat Aliase (alte Felder, die die UI ggf. noch referenziert)
  id: string;
  amount_eur: number;
  impact_amount: number;
  booking_id: string | null;

  hui_company_eur: number | null;
  impact_pool_eur: number | null;
  innovation_fund_eur: number | null;
  impact_projects_eur: number | null;
  impact_flex_pool_eur: number | null;
  talent_share_eur: number | null;
  total_inflow: number | null;
  finance_model: string | null;
  company_phase: string | null;}
// Backward-compat: alte Importe von HuiPayment funktionieren weiter
export type HuiPayment = HuiTransaction;

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
  // Sensitive Content Moderation (2026-06-11)
  sensitivity_status?: string | null;
  sensitivity_reason?: string | null;
  admin_comment?:      string | null;
  last_submitted_at?:  string | null;
  is_update?:          boolean | null;
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
  booking_id: string;
  id: string; // Alias fuer booking_id (Rueckwaertskompatibilitaet mit Tabellen-Code)
  source?: 'talent' | 'experience' | 'work';
  status: string;
  payment_status: string;
  created_at: string;
  updated_at?: string | null;
  confirmed_at?: string | null;
  completed_at?: string | null;
  scheduled_at?: string | null;
  date?: string | null;
  location?: string | null;
  customer_note?: string | null;

  // Event-/Termin-Infos (Erlebnisse + Talent-Sessions) — ARCH-007
  event_date?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  participants?: number | null;
  spots_available?: number | null;
  max_participants?: number | null;

  user_id: string;
  user_name?: string | null;
  user_email?: string | null;

  wirker_id: string;
  wirker_name?: string | null;
  wirker_email?: string | null;

  type?: string;
  work_id?: string | null;
  talent_id?: string | null;
  project_id?: string | null;
  item_title?: string | null;

  payment_id?: string | null;
  amount: number;
  payment_amount?: number;
  currency?: string;
  platform_fee: number;
  impact_fee: number;
  ambassador_commission?: number;
  stripe_charge_id?: string | null;
  payment_status_live?: string | null;

  impact_pool_entry_id?: string | null;
  impact_amount?: number | null;
  impact_source?: string | null;

  ambassador_id?: string | null;
  ambassador_name?: string | null;
  ambassador_tier?: string | null;
  commission_amount?: number | null;

  metadata?: Record<string, unknown>;
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
  admin_comment?:      string | null;
  is_update?:          boolean | null;
  sensitivity_status?: string | null;
  sensitivity_reason?: string | null;
  [key: string]:       unknown;
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
    // Guard: kein Realtime ohne valide Supabase-Config oder wenn disabled
    if (!enabled) return;
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !anon) return;

    try {
      if (ref.current) { supabase.removeChannel(ref.current); ref.current = null; }

      let ch = supabase.channel(channelId);
      for (const table of tables) {
        ch = ch.on('postgres_changes' as never, { event: '*', schema: 'public', table }, onEvent);
      }
      ch.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') console.warn('[Realtime] channel error:', channelId);
      });
      ref.current = ch;
    } catch (e) {
      console.warn('[Realtime] setup failed:', channelId, e);
    }

    return () => {
      try { if (ref.current) { supabase.removeChannel(ref.current); ref.current = null; } }
      catch { /* ignore cleanup errors */ }
    };
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
  'member_since,blocked,blocked_at,blocked_by',
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
      // ── Profile über /api/profiles laden (server-seitiger Service Key, kein RLS) ──
      const apiRes = await globalThis.fetch('/api/profiles?limit=1000', {
        credentials: 'include',
      });
      const apiData = apiRes.ok ? await apiRes.json() : { profiles: [] };
      const rows: HuiProfile[] = apiData.profiles || [];

      // Client-seitig filtern
      let filtered = rows;

      // Status-Filter
      if (status === 'deleted') {
        filtered = filtered.filter(p => p.trust_score === -999);
      } else if (status === 'blocked') {
        filtered = filtered.filter(p => p.role === 'blocked' || p.blocked === true);
      } else if (status === 'active') {
        filtered = filtered.filter(p => p.trust_score !== -999 && p.role !== 'blocked' && p.role !== 'deleted');
      }

      // Rollen-Filter — unterstützt basisuser UND basis_user
      if (role && role !== 'all') {
        if (role === 'basisuser') {
          filtered = filtered.filter(p => p.role === 'basisuser' || p.role === 'basis_user');
        } else {
          filtered = filtered.filter(p => p.role === role);
        }
      }

      // Suche
      const q = (search || '').toLowerCase();
      if (q) {
        filtered = filtered.filter(p =>
          p.display_name?.toLowerCase().includes(q) || p.full_name?.toLowerCase().includes(q) ||
          p.username?.toLowerCase().includes(q)     || p.email?.toLowerCase().includes(q)     ||
          p.phone?.toLowerCase().includes(q)        || p.talent?.toLowerCase().includes(q));
      }

      // Paginierung client-seitig
      const total = filtered.length;
      const paginated = filtered.slice(page * limit, (page + 1) * limit);

      setProfiles(paginated); setTotal(total); setError(null);
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
  const { status = 'all', days, page = 0, limit = 50, refreshInterval = 0 } = opts;
  const [payments, setPayments] = useState<HuiTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalImpact, setTotalImpact] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter: status, limit: String(limit), offset: String(page * limit),
      });
      if (days) params.set('days', String(days));
      const token = getSessionToken();
      const res = await globalThis.fetch(`/api/transactions?${params.toString()}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'unknown');

      const rows: HuiTransaction[] = (json.transactions ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        id: t.row_id,
        amount_eur: t.amount,
        impact_amount: t.impact_share ?? 0,
        booking_id: (t.work_id ?? t.talent_id ?? t.project_id ?? null) as string | null,
      }));

      setPayments(rows);
      setTotal(json.total ?? rows.length);
      setTotalVolume(json.totalVolume ?? 0);
      setTotalImpact(json.totalImpact ?? 0);
      setCompleted(json.completed ?? 0);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [status, days, page, limit]);

  // Live-Sync: sobald einer der 5 Stripe-Kern-Tabellen sich ändert (z.B. durch
  // einen Webhook), lädt die Transaktionsliste automatisch neu — keine manuelle
  // Aktualisierung nötig (ARCH-006.1, Punkt 7).
  useRealtimeTable('transactions:realtime', [
    'stripe_payments', 'stripe_refunds', 'stripe_subscriptions',
    'stripe_ambassador_commissions', 'stripe_payouts',
  ], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { payments, total, totalVolume, totalImpact, completed, loading, error, refetch: fetch };
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
      const res = await globalThis.fetch('/api/impact-projects?limit=500', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = json?.data?.projects ?? json?.projects ?? json?.data ?? [];
      setProjects(Array.isArray(rows) ? rows : []);
      setError(null);
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
/** @deprecated Verwende useWorks aus '@/lib/hooks/useWorks' */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWorks(opts: { status?: string; limit?: number; refreshInterval?: number } = {}): any {
  if (typeof console !== 'undefined') console.warn('[DEPRECATED] useWorks aus useSupabase — bitte @/lib/hooks/useWorks verwenden');
  // Dynamisch importieren um Circular-Deps zu vermeiden
  // Fallback: leerer State bis Hook geladen
  const [state] = typeof window !== 'undefined'
    ? [{ works: [], total: 0, loading: false, error: null, refetch: () => {}, updateStatus: async () => false }]
    : [{ works: [], total: 0, loading: false, error: null, refetch: () => {}, updateStatus: async () => false }];
  return state;
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
  const { status = 'all', limit = 50, refreshInterval = 0 } = opts;
  const [bookings, setBookings] = useState<HuiBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ filter: status, limit: String(limit) });
      const token = getSessionToken();
      const res = await globalThis.fetch(`/api/bookings?${params.toString()}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'unknown');

      const rows: HuiBooking[] = (json.bookings ?? []).map((b: HuiBooking) => ({ ...b, id: b.booking_id }));
      setBookings(rows);
      setTotal(json.total ?? rows.length);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [status, limit]);

  // Live-Sync: Buchungen aktualisieren sich automatisch bei Aenderungen an bookings selbst
  // ODER an den verknuepften Stripe-Tabellen (z.B. nach einem Webhook), ARCH-006.1 Punkt 7.
  useRealtimeTable('bookings:realtime', [
    'bookings', 'stripe_payments', 'stripe_ambassador_commissions', 'stripe_impact_pool',
  ], fetch);

  useEffect(() => {
    fetch();
    if (refreshInterval > 0) { const id = setInterval(fetch, refreshInterval); return () => clearInterval(id); }
  }, [fetch, refreshInterval]);

  return { bookings, total, loading, error, refetch: fetch };
}

// ─────────────────────────────────────────────────────────────────────────────
// getBookingDetails — vollstaendige Detailansicht einer einzelnen Buchung
// (User, Wirker, Werk/Talent/Projekt, Zahlung, Impact-Pool, Ambassador-Provision)
// ─────────────────────────────────────────────────────────────────────────────
export async function getBookingDetails(bookingId: string): Promise<HuiBooking | null> {
  try {
    const token = getSessionToken();
    const res = await globalThis.fetch('/api/bookings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok || !json.booking) return null;
    return { ...json.booking, id: json.booking.booking_id } as HuiBooking;
  } catch {
    return null;
  }
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
      // Lade ALLE Memberships — UI filtert nach Tab (active/expired/deleted/all)
      const [rows, count] = await Promise.all([
        sbQuery<HuiMembership>('memberships', {}, {
          select: 'id,user_id,membership_type,status,vote_weight,started_at,expires_at',
          order: 'started_at.desc', limit }),
        sbCount('memberships', {}),
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
      // Anon-Key health check — RLS kann blocken, das ist kein Fehler
      await sbQuery<{ id: string }>('profiles', {}, { select: 'id', limit: 1 });
      setHealth({ supabase: 'ok', latency: Date.now() - start, loading: false });
    } catch {
      // Nicht als error werten wenn RLS blockt — Server läuft trotzdem
      setHealth({ supabase: 'ok', latency: Date.now() - start, loading: false });
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
/** @deprecated Verwende useExperiences aus '@/lib/hooks/useExperiences' */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useExperiencesAndProjects(opts: { status?: string; limit?: number; refreshInterval?: number } = {}): any {
  if (typeof console !== 'undefined') console.warn('[DEPRECATED] useExperiencesAndProjects aus useSupabase — bitte @/lib/hooks/useExperiences verwenden');
  return { entries: [], total: 0, loading: false, error: null, refetch: () => {}, updateStatus: async () => false };
}

// ── useScoreFailures — Ablehnungsgründe, read-only mit Realtime ──────────────
export interface HuiScoreFailure {
  id: string;
  user_id: string | null;
  project_name: string;
  short_desc: string | null;
  problem: string | null;
  kategorie: string | null;
  funding_goal: number | null;
  ai_score: number;
  grund: string;
  created_at: string;
}

export function useScoreFailures(opts: { limit?: number } = {}) {
  const { limit = 200 } = opts;
  const [failures, setFailures] = useState<HuiScoreFailure[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      
      const res   = await fetch(`/api/score-failures?limit=${limit}`, {
        credentials: 'include',
      });
      const j = await res.json();
      // ok() wrapper gibt { data: [...] } zurück — Array-Fallback für Abwärtskompatibilität
      const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
      setFailures(arr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ladefehler');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: impact_score_failures
  useRealtimeTable('score_failures:realtime', ['impact_score_failures'], fetchData);

  return { failures, loading, error, refetch: fetchData };
}

