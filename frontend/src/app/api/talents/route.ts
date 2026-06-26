// frontend/src/app/api/talents/route.ts
// Talent-Pool: profiles mit is_wirker=true + wirker_profiles Details
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { searchParams } = new URL(req.url);
    const limit    = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);
    const search   = searchParams.get('search') || '';
    const avail    = searchParams.get('available'); // 'true' = nur verfügbare

    // Wirker-Profile laden
    let q = sb.from('profiles')
      .select('id,display_name,username,avatar_url,tagline,talent,skills,is_available,availability,location_label,trust_score,impact_eur,follower_count,has_talent_profile,is_wirker,email,role,created_at,is_ambassador', { count: 'exact' })
      .eq('is_wirker', true)
      .order('is_available', { ascending: false })
      .limit(limit);

    if (avail === 'true') q = q.eq('is_available', true);
    if (search) q = q.or(`display_name.ilike.%${search}%,username.ilike.%${search}%,talent.ilike.%${search}%`);

    const { data: profiles, count, error } = await q;
    if (error) throw error;

    // wirker_profiles für extra Details
    const ids = (profiles ?? []).map(p => p.id);
    const { data: wp } = ids.length
      ? await sb.from('wirker_profiles').select('user_id,slug,talent,wirker_type,tagline,skills,portfolio_url,is_featured').in('user_id', ids)
      : { data: [] };

    const wpMap = new Map((wp ?? []).map(w => [w.user_id, w]));

    const talents = (profiles ?? []).map(p => ({
      ...p,
      wirker: wpMap.get(p.id) ?? null,
      displayName: p.display_name ?? p.username ?? '—',
    }));

    return NextResponse.json({
      talents,
      total:    count ?? 0,
      available: talents.filter(t => t.is_available).length,
      withProfile: talents.filter(t => t.has_talent_profile).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[talents GET]', msg);
    return NextResponse.json({ talents: [], total: 0, available: 0, withProfile: 0, error: msg }, { status: 500 });
  }
}

// PATCH: Verfügbarkeit oder Talent-Info updaten
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id, is_available, talent, tagline } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const updates: Record<string, unknown> = {};
    if (is_available !== undefined) updates.is_available = is_available;
    if (talent      !== undefined) updates.talent       = talent;
    if (tagline     !== undefined) updates.tagline      = tagline;
    const { error } = await sb.from('profiles').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
