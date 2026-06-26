// frontend/src/app/api/ambassador/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').toLowerCase();

    // Ambassadors = profiles mit is_ambassador=true
    const { data: profiles } = await sb
      .from('profiles')
      .select('id,display_name,username,avatar_url,email,role,is_ambassador,referred_by_ambassador_id,created_at,is_wirker,trust_score,impact_eur')
      .eq('is_ambassador', true);

    // Ref-Links
    const { data: refLinks } = await sb
      .from('ambassador_ref_links')
      .select('user_id,ref_link,referral_code,created_at');

    // Ambassador Revenue
    const { data: revenue } = await sb
      .from('ambassador_revenue')
      .select('ambassador_id,total_eur,referral_count');

    const refMap = new Map((refLinks ?? []).map(r => [r.user_id, r]));
    const revMap = new Map((revenue ?? []).map(r => [r.ambassador_id, r]));

    let data = (profiles ?? []).map(p => ({
      id:             p.id,
      displayName:    p.display_name ?? p.username ?? p.email ?? '—',
      username:       p.username ?? '',
      avatarUrl:      p.avatar_url ?? null,
      email:          p.email ?? null,
      role:           p.role ?? 'user',
      isWirker:       p.is_wirker ?? false,
      trustScore:     p.trust_score ?? 0,
      impactEur:      p.impact_eur ?? 0,
      createdAt:      p.created_at,
      referralCode:   refMap.get(p.id)?.referral_code ?? null,
      referralLink:   refMap.get(p.id)?.ref_link ?? null,
      referralCount:  revMap.get(p.id)?.referral_count ?? 0,
      revenueEur:     revMap.get(p.id)?.total_eur ?? 0,
    }));

    if (search) {
      data = data.filter(a =>
        a.displayName.toLowerCase().includes(search) ||
        a.email?.toLowerCase().includes(search) ||
        a.username?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ ok: true, data, total: data.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// PATCH: Ambassador-Status setzen / entziehen
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { user_id, action } = await req.json();
    if (!user_id || !action) return NextResponse.json({ ok: false, error: 'Fehlende Parameter' }, { status: 400 });
    const sb = getServiceClient();

    if (action === 'activate') {
      await sb.from('profiles').update({ is_ambassador: true }).eq('id', user_id);
      // Ref-Link anlegen falls nicht vorhanden
      const { data: prof } = await sb.from('profiles').select('username').eq('id', user_id).single();
      const username = prof?.username ?? user_id.slice(0,8);
      const code = `AMB-${username.toUpperCase().slice(0,5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
      await sb.from('ambassador_ref_links').upsert({
        user_id, username,
        ref_link: `https://be-hui.com/${username}`,
        referral_code: code,
      }, { onConflict: 'user_id' });
    } else if (action === 'deactivate') {
      await sb.from('profiles').update({ is_ambassador: false }).eq('id', user_id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
