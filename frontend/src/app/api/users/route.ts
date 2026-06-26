// frontend/src/app/api/users/route.ts
// GET /api/users — Merged User List: auth.users + profiles (Full Outer Join)
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
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

// Auth-User via Supabase Admin REST API laden
async function fetchAuthUsers(): Promise<Array<{
  id: string; email?: string; created_at: string;
  last_sign_in_at?: string; banned_until?: string;
  deleted_at?: string; user_metadata?: Record<string,unknown>;
  app_metadata?: Record<string,unknown>;
}>> {
  const supabaseUrl     = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceRoleKey) return [];

  const allUsers: unknown[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error('fetchAuthUsers error:', res.status, txt);
      break;
    }

    const data = await res.json() as { users?: unknown[]; total?: number };
    const users = data.users ?? (Array.isArray(data) ? data : []);
    allUsers.push(...users);

    if (users.length < perPage) break;
    page++;
  }

  return allUsers as ReturnType<typeof fetchAuthUsers> extends Promise<infer T> ? T : never;
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '500'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = getServiceClient();

    // 1) Auth-User laden (Fehler abfangen — bei Fehler weiter mit nur Profiles)
    let authUsers: Awaited<ReturnType<typeof fetchAuthUsers>> = [];
    try {
      authUsers = await fetchAuthUsers();
    } catch (authErr) {
      console.error('/api/users — fetchAuthUsers failed, falling back to profiles-only:', authErr);
    }

    // 2) Profile laden
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id,display_name,username,full_name,avatar_url,role,membership_type,is_wirker,is_member,blocked,is_deleted,impact_eur,trust_score,last_seen_at,email,created_at');

    if (profErr) throw profErr;

    // 3) Maps aufbauen
    const profileMap = new Map<string, NonNullable<typeof profiles>[0]>();
    (profiles ?? []).forEach(p => profileMap.set(p.id, p));
    const authMap = new Map<string, typeof authUsers[0]>();
    authUsers.forEach(u => authMap.set(u.id, u));

    // 4) Full Outer Join
    const merged: MergedUser[] = [];

    // 4a) Auth-User (mit oder ohne Profil)
    for (const au of authUsers) {
      const p = profileMap.get(au.id);
      const isBanned   = au.banned_until ? new Date(au.banned_until) > new Date() : false;
      const isDeleted  = !!au.deleted_at;
      merged.push({
        id:              au.id,
        email:           au.email ?? p?.email ?? null,
        created_at:      au.created_at,
        last_sign_in_at: au.last_sign_in_at ?? null,
        display_name:    p?.display_name ?? null,
        username:        p?.username ?? null,
        full_name:       p?.full_name ?? (au.user_metadata?.full_name as string) ?? null,
        avatar_url:      p?.avatar_url ?? (au.user_metadata?.avatar_url as string) ?? null,
        role:            p?.role ?? (au.app_metadata?.role as string) ?? 'user',
        membership_type: p?.membership_type ?? null,
        is_wirker:       p?.is_wirker ?? false,
        is_member:       p?.is_member ?? false,
        blocked:         p?.blocked ?? isBanned,
        is_deleted:      p?.is_deleted ?? isDeleted,
        impact_eur:      p?.impact_eur ?? 0,
        trust_score:     p?.trust_score ?? 0,
        last_seen_at:    p?.last_seen_at ?? au.last_sign_in_at ?? null,
        source:          p ? 'both' : 'auth_only',
      });
    }

    // 4b) Profile-only (nicht in auth.users)
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

    // 5) Filtern
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

    // 6) Sortieren + Paginieren
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total     = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    // 7) Zähler
    const counts = {
      total:   merged.length,
      active:  merged.filter(u => !u.blocked && !u.is_deleted).length,
      blocked: merged.filter(u => u.blocked && !u.is_deleted).length,
      deleted: merged.filter(u => u.is_deleted).length,
      wirker:  merged.filter(u => u.is_wirker).length,
    };

    return ok({ users: paginated, total, counts });
  } catch (err) {
    console.error('/api/users error:', err);
    return serverError(err, 'users GET');
  }
}
