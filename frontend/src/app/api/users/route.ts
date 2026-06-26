// frontend/src/app/api/users/route.ts
// GET /api/users — Merged User List: auth.users LEFT JOIN profiles
// Nutzt service_role für vollen Zugriff auf auth.users
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export interface MergedUser {
  id:             string;
  email:          string | null;
  created_at:     string;
  last_sign_in_at:string | null;
  // aus profiles
  display_name:   string | null;
  username:       string | null;
  full_name:      string | null;
  avatar_url:     string | null;
  role:           string;
  membership_type:string | null;
  is_wirker:      boolean;
  is_member:      boolean;
  blocked:        boolean;
  is_deleted:     boolean;
  impact_eur:     number;
  trust_score:    number;
  last_seen_at:   string | null;
  // meta
  source: 'both' | 'auth_only' | 'profile_only';
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);
    const filter  = searchParams.get('filter') || 'all';   // all|active|blocked|deleted|wirker
    const search  = searchParams.get('search') || '';
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '500'), 1000);
    const offset  = parseInt(searchParams.get('offset') || '0', 10);

    // 1) Alle Auth-User laden (service_role Zugriff auf auth.users)
    const { data: authUsers, error: authErr } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 10000 });
    if (authErr) throw authErr;

    // 2) Alle Profile laden
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id,display_name,username,full_name,avatar_url,role,membership_type,is_wirker,is_member,blocked,is_deleted,impact_eur,trust_score,last_seen_at,email,created_at,updated_at,blocked_at,blocked_by');
    if (profErr) throw profErr;

    // 3) Profile-Map aufbauen
    const profileMap = new Map<string, typeof profiles[0]>();
    (profiles ?? []).forEach(p => profileMap.set(p.id, p));

    // 4) Auth-User-Map aufbauen
    const authMap = new Map<string, typeof authUsers.users[0]>();
    (authUsers?.users ?? []).forEach(u => authMap.set(u.id, u));

    // 5) FULL OUTER JOIN: auth.users LEFT JOIN profiles + profile_only
    const merged: MergedUser[] = [];

    // 5a) Auth-User (mit oder ohne Profil)
    for (const au of authUsers?.users ?? []) {
      const p = profileMap.get(au.id);
      merged.push({
        id:              au.id,
        email:           au.email ?? p?.email ?? null,
        created_at:      au.created_at,
        last_sign_in_at: au.last_sign_in_at ?? null,
        display_name:    p?.display_name ?? null,
        username:        p?.username ?? null,
        full_name:       p?.full_name ?? au.user_metadata?.full_name ?? null,
        avatar_url:      p?.avatar_url ?? au.user_metadata?.avatar_url ?? null,
        role:            p?.role ?? au.app_metadata?.role ?? au.user_metadata?.role ?? 'user',
        membership_type: p?.membership_type ?? null,
        is_wirker:       p?.is_wirker ?? false,
        is_member:       p?.is_member ?? false,
        blocked:         p?.blocked ?? (au.banned_until ? new Date(au.banned_until) > new Date() : false),
        is_deleted:      p?.is_deleted ?? !!au.deleted_at,
        impact_eur:      p?.impact_eur ?? 0,
        trust_score:     p?.trust_score ?? 0,
        last_seen_at:    p?.last_seen_at ?? au.last_sign_in_at ?? null,
        source:          p ? 'both' : 'auth_only',
      });
    }

    // 5b) Profile-only (existieren nicht in auth.users)
    for (const p of profiles ?? []) {
      if (!authMap.has(p.id)) {
        merged.push({
          id:              p.id,
          email:           p.email ?? null,
          created_at:      p.created_at,
          last_sign_in_at: p.last_seen_at ?? null,
          display_name:    p.display_name ?? null,
          username:        p.username ?? null,
          full_name:       p.full_name ?? null,
          avatar_url:      p.avatar_url ?? null,
          role:            p.role ?? 'user',
          membership_type: p.membership_type ?? null,
          is_wirker:       p.is_wirker ?? false,
          is_member:       p.is_member ?? false,
          blocked:         p.blocked ?? false,
          is_deleted:      p.is_deleted ?? false,
          impact_eur:      p.impact_eur ?? 0,
          trust_score:     p.trust_score ?? 0,
          last_seen_at:    p.last_seen_at ?? null,
          source:          'profile_only',
        });
      }
    }

    // 6) Filtern
    let filtered = merged;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }

    if (filter === 'active')  filtered = filtered.filter(u => !u.blocked && !u.is_deleted);
    if (filter === 'blocked') filtered = filtered.filter(u => u.blocked && !u.is_deleted);
    if (filter === 'deleted') filtered = filtered.filter(u => u.is_deleted);
    if (filter === 'wirker')  filtered = filtered.filter(u => u.is_wirker);

    // 7) Sortieren: neueste zuerst
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 8) Paginierung
    const total      = filtered.length;
    const paginated  = filtered.slice(offset, offset + limit);

    // 9) Zähler
    const counts = {
      total:   merged.length,
      active:  merged.filter(u => !u.blocked && !u.is_deleted).length,
      blocked: merged.filter(u => u.blocked && !u.is_deleted).length,
      deleted: merged.filter(u => u.is_deleted).length,
      wirker:  merged.filter(u => u.is_wirker).length,
    };

    return ok({ users: paginated, total, counts });
  } catch (err) {
    return serverError(err, 'users GET');
  }
}
