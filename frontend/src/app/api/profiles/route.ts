// frontend/src/app/api/profiles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { searchParams } = new URL(req.url);
    const limit     = Math.min(parseInt(searchParams.get('limit')    || '1000', 10), 500);
    const offset    = parseInt(searchParams.get('offset')   || '0', 10);
    const search    = searchParams.get('search')    || '';
    const is_wirker = searchParams.get('is_wirker'); // 'true'|'false'|null
    const role      = searchParams.get('role')      || '';
    const blocked   = searchParams.get('blocked')   || '';

    let q = sb.from('profiles')
      .select('id,display_name,username,avatar_url,bio,tagline,role,membership_type,is_wirker,is_member,membership_active,has_talent_profile,talent,location,location_label,is_available,availability,impact_eur,follower_count,followers_count,trust_score,is_guardian,last_seen,last_seen_at,created_at,updated_at,skills,focus_type,email,phone,full_name,is_talent,talent_since,talent_activated_at,member_since,blocked,blocked_at,blocked_by,is_ambassador', { count: 'exact' })
      .not('email', 'like', '%hui-commerce.test%')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (is_wirker === 'true')  q = q.eq('is_wirker', true);
    if (is_wirker === 'false') q = q.eq('is_wirker', false);
    if (role && role !== 'all') q = q.eq('role', role);
    if (blocked === 'true') q = q.eq('blocked', true);

    if (search) {
      q = q.or(
        `display_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error, count } = await q;
    if (error) throw error;

    // Impact-Anteil pro Nutzer (Käufer+Verkäufer) — SSOT via stripe_impact_pool,
    // ersetzt das tote profiles.impact_eur (nie beschrieben, immer 0).
    // Gleiche RPC wie /api/users (SADB) — siehe Standing Instructions.
    let profilesOut: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];
    try {
      const { data: impactRows, error: impactErr } = await sb.rpc('rpc_get_user_impact_totals');
      if (impactErr) {
        console.error('[profiles GET] impact totals rpc error:', impactErr.message);
      } else {
        const impactMap = new Map<string, number>();
        (impactRows ?? []).forEach((r: { user_id: string; impact_eur: number | string }) => {
          impactMap.set(r.user_id, Number(r.impact_eur ?? 0));
        });
        profilesOut = profilesOut.map((p) => ({
          ...p,
          impact_eur: impactMap.get(p.id as string) ?? 0,
        }));
      }
    } catch (e) { console.error('[profiles GET] impact totals rpc exception:', e); }

    // Flache Antwort — kein ok()-Wrapper damit useProfiles direkt lesen kann
    return NextResponse.json({ profiles: profilesOut, total: count ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[profiles GET]', msg);
    return NextResponse.json({ profiles: [], total: 0, error: msg }, { status: 500 });
  }
}
