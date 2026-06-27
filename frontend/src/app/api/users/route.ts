// frontend/src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

type AuthUser = {
  id: string; email?: string; created_at: string;
  last_sign_in_at?: string; banned_until?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?:  Record<string, unknown>;
};

// Nur Spalten die in der profiles-Tabelle tatsächlich existieren
interface Profile {
  id: string;
  email: string | null;
  created_at: string;
  display_name: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  membership_type: string | null;
  is_wirker: boolean | null;
  is_member: boolean | null;
  blocked: boolean | null;
  blocked_at: string | null;
  blocked_by: string | null;
  phone: string | null;
  impact_eur: number | null;
  trust_score: number | null;
  last_seen_at: string | null;
  location_label: string | null;
}

interface MergedUser {
  id: string; email: string | null; created_at: string;
  last_sign_in_at: string | null; display_name: string | null;
  username: string | null; full_name: string | null;
  avatar_url: string | null; role: string; membership_type: string | null;
  is_wirker: boolean; is_member: boolean;
  blocked: boolean; blocked_reason: string | null; blocked_at: string | null;
  phone: string | null; is_deleted: boolean;
  impact_eur: number; trust_score: number; last_seen_at: string | null;
  location_label: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  dna_tags: string[];
  source: string;
}

// Nur existierende Spalten — kein blocked_reason, kein is_deleted in DB
const PROFILE_COLS = [
  'id','display_name','username','full_name','avatar_url','role',
  'membership_type','is_wirker','is_member',
  'blocked','blocked_at','blocked_by','phone',
  'impact_eur','trust_score','last_seen_at','email','created_at',
  'location_label','bio','tagline','location','dna_tags',
].join(',');

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const limit  = Math.min(parseInt(searchParams.get('limit') || '1000'), 2000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase    = getServiceClient();
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    // 1) Auth Users
    let authUsers: AuthUser[] = [];
    if (supabaseUrl && serviceKey) {
      try {
        let page = 1;
        while (true) {
          const res = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`,
            { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }, cache: 'no-store' }
          );
          if (!res.ok) break;
          const body = await res.json() as { users?: AuthUser[] } | AuthUser[];
          const users: AuthUser[] = Array.isArray(body) ? body
            : ((body as { users?: AuthUser[] }).users ?? []);
          authUsers.push(...users);
          if (users.length < 1000) break;
          page++;
        }
      } catch(e) { console.error('[users] auth error:', e); }
    }

    // 2) Profiles — nur existierende Spalten
    const { data: rawProfiles, error: profErr } = await supabase
      .from('profiles')
      .select(PROFILE_COLS);

    if (profErr) {
      console.error('[users GET] profiles error:', profErr.message);
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }

    const profiles = (rawProfiles ?? []) as unknown as Profile[];

    // 3) Maps
    const profileMap = new Map<string, Profile>();
    profiles.forEach(p => profileMap.set(p.id, p));
    const authMap = new Map<string, AuthUser>();
    authUsers.forEach(u => authMap.set(u.id, u));

    // 4) Merge
    const merged: MergedUser[] = [];

    for (const au of authUsers) {
      const p = profileMap.get(au.id);
      const isBanned = !!au.banned_until && new Date(au.banned_until) > new Date();
      merged.push({
        id:              au.id,
        email:           au.email ?? p?.email ?? null,
        created_at:      au.created_at,
        last_sign_in_at: au.last_sign_in_at ?? null,
        display_name:    p?.display_name ?? null,
        username:        p?.username ?? null,
        full_name:       p?.full_name ?? String(au.user_metadata?.full_name ?? ''),
        avatar_url:      p?.avatar_url ?? null,
        role:            p?.role ?? String(au.app_metadata?.role ?? 'user'),
        membership_type: p?.membership_type ?? null,
        is_wirker:       Boolean(p?.is_wirker),
        is_member:       Boolean(p?.is_member),
        blocked:         Boolean(p?.blocked) || isBanned,
        blocked_reason:  p?.blocked_by ?? null,   // blocked_by als Grund-Fallback
        blocked_at:      p?.blocked_at ?? null,
        phone:           p?.phone ?? null,
        is_deleted:      false,
        impact_eur:      Number(p?.impact_eur ?? 0),
        trust_score:     Number(p?.trust_score ?? 0),
        last_seen_at:    p?.last_seen_at ?? au.last_sign_in_at ?? null,
        location_label:  p?.location_label ?? null,
        bio:             (p as unknown as Record<string,unknown>)?.bio as string | null ?? null,
        tagline:         (p as unknown as Record<string,unknown>)?.tagline as string | null ?? null,
        location:        (p as unknown as Record<string,unknown>)?.location as string | null ?? null,
        dna_tags:        [] as string[],
        source:          p ? 'both' : 'auth_only',
      });
    }

    // Nur-Profile ohne Auth-Account
    for (const p of profiles) {
      if (!authMap.has(p.id)) {
        merged.push({
          id: p.id, email: p.email, created_at: p.created_at,
          last_sign_in_at: p.last_seen_at ?? null,
          display_name: p.display_name, username: p.username,
          full_name: p.full_name, avatar_url: p.avatar_url,
          role: p.role ?? 'user', membership_type: p.membership_type,
          is_wirker: Boolean(p.is_wirker), is_member: Boolean(p.is_member),
          blocked: Boolean(p.blocked),
          blocked_reason: p.blocked_by ?? null,
          blocked_at: p.blocked_at ?? null,
          phone: p.phone ?? null,
          is_deleted: false,
          impact_eur: Number(p.impact_eur ?? 0),
          trust_score: Number(p.trust_score ?? 0),
          last_seen_at: p.last_seen_at,
          location_label: p.location_label ?? null,
          bio:    (p as unknown as Record<string,unknown>).bio as string | null ?? null,
          tagline:(p as unknown as Record<string,unknown>).tagline as string | null ?? null,
          location:(p as unknown as Record<string,unknown>).location as string | null ?? null,
          dna_tags: [] as string[],
          source: 'profile_only',
        });
      }
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 5) Filter
    let filtered = merged;
    if (search) filtered = filtered.filter(u =>
      u.email?.toLowerCase().includes(search) ||
      u.display_name?.toLowerCase().includes(search) ||
      u.username?.toLowerCase().includes(search) ||
      u.full_name?.toLowerCase().includes(search) ||
      u.id.toLowerCase().includes(search)
    );
    if (filter === 'active')  filtered = filtered.filter(u => !u.blocked && !u.is_deleted);
    if (filter === 'blocked') filtered = filtered.filter(u =>  u.blocked && !u.is_deleted);
    if (filter === 'deleted') filtered = filtered.filter(u =>  u.is_deleted);
    if (filter === 'wirker')  filtered = filtered.filter(u =>  u.is_wirker);

    const counts = {
      total:   merged.length,
      active:  merged.filter(u => !u.blocked && !u.is_deleted).length,
      blocked: merged.filter(u =>  u.blocked && !u.is_deleted).length,
      deleted: 0,
      wirker:  merged.filter(u =>  u.is_wirker).length,
    };

    return NextResponse.json({
      users:  filtered.slice(offset, offset + limit),
      total:  filtered.length,
      counts,
    }, { status: 200 });

  } catch (err) {
    console.error('[users GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
