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

    // 1. Alle Ambassadors
    const { data: profiles, error: profErr } = await sb
      .from('profiles')
      .select('id,display_name,username,avatar_url,email,is_ambassador,profile_modules,created_at,impact_eur')
      .eq('is_ambassador', true);

    if (profErr) throw profErr;

    // 2. Ref-Links
    const { data: refLinks } = await sb
      .from('ambassador_ref_links')
      .select('user_id,ref_link,referral_code,created_at');

    // 3. Geworbene Nutzer (referred_by COUNT + Liste) — live aus profiles
    const ambassadorIds = (profiles ?? []).map(p => p.id);
    let referredMap: Record<string, { count: number; active: number; sleeping: number; users: any[] }> = {};

    if (ambassadorIds.length > 0) {
      const { data: referred } = await sb
        .from('profiles')
        .select('id,display_name,username,avatar_url,email,referred_by,created_at,first_transaction_at')
        .in('referred_by', ambassadorIds);

      for (const u of (referred ?? [])) {
        const ambId = u.referred_by;
        if (!referredMap[ambId]) referredMap[ambId] = { count: 0, active: 0, sleeping: 0, users: [] };
        referredMap[ambId].count++;
        if (u.first_transaction_at) referredMap[ambId].active++;
        else referredMap[ambId].sleeping++;
        referredMap[ambId].users.push({
          id:               u.id,
          displayName:      u.display_name ?? u.username ?? u.email ?? '—',
          username:         u.username ?? '',
          avatarUrl:        u.avatar_url ?? null,
          email:            u.email ?? null,
          joinedAt:         u.created_at,
          firstTransaction: u.first_transaction_at,
          isActive:         !!u.first_transaction_at,
        });
      }
    }

    const refMap = new Map((refLinks ?? []).map(r => [r.user_id, r]));

    // Level berechnen aus referral_count
    function calcLevel(count: number): string {
      if (count >= 201) return 'Platin';
      if (count >= 51)  return 'Gold';
      if (count >= 11)  return 'Silber';
      return 'Bronze';
    }
    function levelStyle(level: string): { label: string; color: string } {
      if (level === 'Gold')   return { label: '🥇 Gold',   color: '#ffd43b' };
      if (level === 'Silber') return { label: '🥈 Silber', color: '#ced4da' };
      if (level === 'Platin') return { label: '💎 Platin', color: '#b197fc' };
      return                         { label: '🥉 Bronze', color: '#cd7f32' };
    }

    let data = (profiles ?? []).map(p => {
      const ambMod   = (p.profile_modules as any)?.ambassador ?? {};
      const refData  = referredMap[p.id] ?? { count: 0, active: 0, sleeping: 0, users: [] };
      const refCount = Math.max(refData.count, Number(ambMod.referral_count ?? 0));
      const revenue  = Number(ambMod.revenue_generated ?? ambMod.revenue_total ?? 0);
      const level    = calcLevel(refCount);

      return {
        id:              p.id,
        displayName:     p.display_name ?? p.username ?? p.email ?? '—',
        username:        p.username ?? '',
        avatarUrl:       p.avatar_url ?? null,
        email:           p.email ?? null,
        impactEur:       p.impact_eur ?? 0,
        createdAt:       p.created_at,
        referralCode:    refMap.get(p.id)?.referral_code ?? ambMod.referral_code ?? null,
        referralLink:    refMap.get(p.id)?.ref_link ?? ambMod.ref_link ?? ambMod.referral_link ?? null,
        referralCount:   refCount,
        activeCount:     refData.active,
        sleepingCount:   refData.sleeping,
        revenueEur:      revenue,
        level:           level,
        levelLabel:      levelStyle(level).label,
        levelColor:      levelStyle(level).color,
        linkActive:      ambMod.link_active !== false,
        activatedAt:     ambMod.activated_at ?? null,
        referredUsers:   refData.users,
      };
    });

    if (search) {
      data = data.filter(a =>
        a.displayName.toLowerCase().includes(search) ||
        (a.email ?? '').toLowerCase().includes(search) ||
        (a.username ?? '').toLowerCase().includes(search)
      );
    }

    const totals = {
      count:   data.length,
      revenue: data.reduce((s, a) => s + a.revenueEur, 0),
      referrals: data.reduce((s, a) => s + a.referralCount, 0),
    };

    return NextResponse.json({ ok: true, data, totals });
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
      const { data: prof } = await sb.from('profiles').select('username').eq('id', user_id).single();
      if (prof?.username) {
        const code = 'AMB-' + prof.username.toUpperCase().slice(0, 5) + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
        await sb.from('ambassador_ref_links').upsert(
          { user_id, username: prof.username, ref_link: `https://be-hui.com/${prof.username}`, referral_code: code },
          { onConflict: 'user_id' }
        );
      }
    } else if (action === 'deactivate') {
      await sb.from('profiles')
        .update({ is_ambassador: false })
        .eq('id', user_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
