// frontend/src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export interface MergedUser {
  id:              string;
  email:           string | null;
  created_at:      string;
  last_sign_in_at: string | null;
  display_name:    string | null;
  username:        string | null;
  full_name:       string | null;
  avatar_url:      string | null;
  role:            string;
  membership_type: string | null;
  is_wirker:       boolean;
  is_member:       boolean;
  blocked:         boolean;
  is_deleted:      boolean;
  impact_eur:      number;
  trust_score:     number;
  last_seen_at:    string | null;
  source:          'both' | 'auth_only' | 'profile_only';
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase();
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase      = getServiceClient();
    const supabaseUrl   = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    // ── 1) auth.users via Admin REST API ───────────────────────────
    type AuthUser = {
      id: string; email?: string; created_at: string;
      last_sign_in_at?: string; banned_until?: string;
      deleted_at?: string; user_metadata?: Record<string,unknown>;
      app_metadata?: Record<string,unknown>;
    };

    let authUsers: AuthUser[] = [];
    if (supabaseUrl && serviceKey) {
      try {
        let page = 1;
        while (true) {
          const res = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`,
            { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } }
          );
          if (!res.ok) { console.error('auth.users fetch:', res.status, await res.text()); break; }
          const body = await res.json() as { users?: AuthUser[] } | AuthUser[];
          const users: AuthUser[] = Array.isArray(body) ? body : (body as { users?: AuthUser[] }).users ?? [];
          authUsers.push(...users);
          if (users.length < 1000) break;
          page++;
        }
      } catch (e) {
        console.error('fetchAuthUsers failed:', e);
      }
    }

    // ── 2) profiles ────────────────────────────────────────────────
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id,display_name,username,full_name,avatar_url,role,membership_type,is_wirker,is_member,blocked,impact_eur,trust_score,last_seen_at,email,created_at');
    if (profErr) throw profErr;

    // ── 3) Maps ────────────────────────────────────────────────────
    type Profile = NonNullable<typeof profiles>[0];
    const profileMap = new Map<string, Profile>();
    (profiles ?? []).forEach(p => profileMap.set(p.id, p));
    const authMap = new Map<string, AuthUser>();
    authUsers.forEach(u => authMap.set(u.id, u));

    // ── 4) Merge ───────────────────────────────────────────────────
    const merged: MergedUser[] = [];

    for (const au of authUsers) {
      const p = profileMap.get(au.id);
      merged.push({
        id:              au.id,
        email:           au.email ?? p?.email ?? null,
        created_at:      au.created_at,
        last_sign_in_at: au.last_sign_in_at ?? null,
        display_name:    p?.display_name ?? null,
        username:        p?.username ?? null,
        full_name:       p?.full_name ?? String(au.user_metadata?.full_name ?? ''),
        avatar_url:      p?.avatar_url ?? String(au.user_metadata?.avatar_url ?? ''),
        role:            p?.role ?? String(au.app_metadata?.role ?? 'user'),
        membership_type: p?.membership_type ?? null,
        is_wirker:       p?.is_wirker ?? false,
        is_member:       p?.is_member ?? false,
        blocked:         p?.blocked ?? (!!au.banned_until && new Date(au.banned_until) > new Date()),
        is_deleted:      false ?? !!au.deleted_at,
        impact_eur:      p?.impact_eur ?? 0,
        trust_score:     p?.trust_score ?? 0,
        last_seen_at:    p?.last_seen_at ?? au.last_sign_in_at ?? null,
        source:          p ? 'both' : 'auth_only',
      });
    }
    for (const p of profiles ?? []) {
      if (!authMap.has(p.id)) {
        merged.push({
          id: p.id, email: p.email ?? null, created_at: p.created_at,
          last_sign_in_at: p.last_seen_at ?? null,
          display_name: p.display_name ?? null, username: p.username ?? null,
          full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null,
          role: p.role ?? 'user', membership_type: p.membership_type ?? null,
          is_wirker: p.is_wirker ?? false, is_member: p.is_member ?? false,
          blocked: p.blocked ?? false, is_deleted: p.is_deleted ?? false,
          impact_eur: p.impact_eur ?? 0, trust_score: p.trust_score ?? 0,
          last_seen_at: p.last_seen_at ?? null, source: 'profile_only',
        });
      }
    }

    // ── 5) Filter ──────────────────────────────────────────────────
    let filtered = merged;
    if (search) filtered = filtered.filter(u =>
      u.email?.toLowerCase().includes(search) ||
      u.display_name?.toLowerCase().includes(search) ||
      u.username?.toLowerCase().includes(search) ||
      u.id.toLowerCase().includes(search)
    );
    if (filter === 'active')  filtered = filtered.filter(u => !u.blocked && !false);
    if (filter === 'blocked') filtered = filtered.filter(u => u.blocked && !false);
    if (filter === 'deleted') filtered = filtered.filter(u => false);
    if (filter === 'wirker')  filtered = filtered.filter(u => u.is_wirker);

    filtered.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total     = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const counts = {
      total:   merged.length,
      active:  merged.filter(u => !u.blocked && !false).length,
      blocked: merged.filter(u => u.blocked  && !false).length,
      deleted: merged.filter(u => false).length,
      wirker:  merged.filter(u => u.is_wirker).length,
    };

    // Direkt ohne ok()-Wrapper zurückgeben (kein extra .data nötig im Client)
    return NextResponse.json({ users: paginated, total, counts }, { status: 200 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[users GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
