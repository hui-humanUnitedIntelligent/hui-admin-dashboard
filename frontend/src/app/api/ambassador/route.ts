// frontend/src/app/api/ambassador/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

function generateCode(username: string): string {
  const base = (username || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 4);
  const level = 'B1';
  return `HUI-${base}-${level}${suffix}`;
}

function calcLevel(referralCount: number, revenueGenerated: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (referralCount >= 20 || revenueGenerated >= 1000) return 'platinum';
  if (referralCount >= 10 || revenueGenerated >= 400)  return 'gold';
  if (referralCount >= 3  || revenueGenerated >= 100)  return 'silver';
  return 'bronze';
}

async function sb(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H, ...opts });
  const b = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body: b };
}

// GET — list ambassadors, stats, or single ambassador
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const userId = searchParams.get('user_id');

  // Single ambassador detail
  if (action === 'detail' && userId) {
    const r = await sb(`profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules`);
    const profile = Array.isArray(r.body) && r.body[0];
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const amb = (profile.profile_modules as Record<string,unknown>)?.ambassador as Record<string,unknown>;
    if (!amb?.is_ambassador) return NextResponse.json({ error: 'Not an ambassador' }, { status: 404 });

    // Get referrals — profiles that have referred_by = this user's referral_code
    const refCode = amb.referral_code as string;
    const allProfiles = await sb(`profiles?select=id,display_name,username,avatar_url,created_at,profile_modules&limit=500`);
    const referred = (Array.isArray(allProfiles.body) ? allProfiles.body : []).filter((p: Record<string,unknown>) => {
      const pm = p.profile_modules as Record<string,unknown>;
      return pm?.referred_by === refCode;
    });

    // Get payments from referred users
    let totalRevenue = 0;
    let totalImpact  = 0;
    if (referred.length > 0) {
      const ids = referred.map((p: Record<string,unknown>) => p.id as string).join(',');
      const pays = await sb(`payments?payer_id=in.(${ids})&select=amount_eur,impact_amount&limit=1000`);
      if (Array.isArray(pays.body)) {
        for (const p of pays.body as Record<string,unknown>[]) {
          totalRevenue += Number(p.amount_eur) || 0;
          totalImpact  += Number(p.impact_amount) || 0;
        }
      }
    }

    const level = calcLevel(referred.length, totalRevenue);
    return NextResponse.json({
      profile: { ...profile, profile_modules: undefined },
      ambassador: {
        ...amb,
        level,
        referral_count:     referred.length,
        revenue_generated:  totalRevenue,
        impact_generated:   totalImpact,
      },
      referrals: referred.map((p: Record<string,unknown>) => ({
        id:           p.id,
        display_name: p.display_name,
        username:     p.username,
        avatar_url:   p.avatar_url,
        joined_at:    p.created_at,
      })),
    });
  }

  // List all ambassadors
  if (action === 'list') {
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string,unknown>[] : [];
    const ambassadors = all.filter(p => {
      const pm = p.profile_modules as Record<string,unknown>;
      return pm?.ambassador && (pm.ambassador as Record<string,unknown>).is_ambassador === true;
    }).map(p => {
      const pm = p.profile_modules as Record<string,unknown>;
      const amb = pm.ambassador as Record<string,unknown>;
      return {
        id:               p.id,
        display_name:     p.display_name,
        username:         p.username,
        avatar_url:       p.avatar_url,
        role:             p.role,
        is_wirker:        p.is_wirker,
        trust_score:      p.trust_score,
        created_at:       p.created_at,
        referral_code:    amb.referral_code,
        level:            amb.level,
        status:           amb.status,
        ambassador_since: amb.ambassador_since,
        referral_count:   amb.referral_count || 0,
        revenue_generated:amb.revenue_generated || 0,
        rewards:          amb.rewards || [],
      };
    });
    return NextResponse.json(ambassadors);
  }

  // Stats for dashboard
  if (action === 'stats') {
    const r = await sb(`profiles?select=id,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string,unknown>[] : [];
    const ambassadors = all.filter(p => {
      const pm = p.profile_modules as Record<string,unknown>;
      return pm?.ambassador && (pm.ambassador as Record<string,unknown>).is_ambassador === true;
    });

    let totalReferrals = 0;
    let totalRevenue   = 0;
    const levelDist: Record<string,number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    for (const p of ambassadors) {
      const pm = p.profile_modules as Record<string,unknown>;
      const amb = pm.ambassador as Record<string,unknown>;
      totalReferrals += Number(amb.referral_count) || 0;
      totalRevenue   += Number(amb.revenue_generated) || 0;
      const lvl = (amb.level as string) || 'bronze';
      levelDist[lvl] = (levelDist[lvl] || 0) + 1;
    }

    // Referred users (profiles with referred_by set)
    const referredCount = all.filter(p => {
      const pm = p.profile_modules as Record<string,unknown>;
      return !!(pm?.referred_by);
    }).length;

    // Impact from ambassador revenue (15% model)
    const grossImpact = totalRevenue * 0.15;
    const netImpact   = grossImpact * 0.85;

    return NextResponse.json({
      active_ambassadors: ambassadors.length,
      total_referrals:    totalReferrals,
      referred_users:     referredCount,
      total_revenue:      totalRevenue,
      gross_impact:       grossImpact,
      net_impact:         netImpact,
      level_distribution: levelDist,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST — create, promote, update, revoke
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });

  const body = await req.json();
  const { action, user_id, data } = body;

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  // Get current profile
  const pr = await sb(`profiles?id=eq.${user_id}&select=id,username,display_name,profile_modules`);
  const profile = Array.isArray(pr.body) && pr.body[0] as Record<string,unknown>;
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const pm = (profile.profile_modules as Record<string,unknown>) || {};
  const now = new Date().toISOString();

  // Create ambassador
  if (action === 'create') {
    const code = generateCode((profile.username as string) || (profile.display_name as string) || '');
    const newAmb = {
      is_ambassador:    true,
      referral_code:    code,
      level:            'bronze',
      status:           'active',
      ambassador_since: now,
      referral_count:   0,
      revenue_generated:0,
      rewards:          [{ type: 'badge', name: 'Bronze-Badge', granted_at: now }],
      agreed_at:        data?.agreed_at || now,
    };
    const upd = await sb(`profiles?id=eq.${user_id}`, {
      method:  'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body:    JSON.stringify({ profile_modules: { ...pm, ambassador: newAmb } }),
    });
    if (!upd.ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    // Log to notification_events
    await sb('notification_events', {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ type: 'ambassador_created', actor_id: null, target_user_id: user_id, metadata: { referral_code: code, level: 'bronze' }, created_at: now }),
    });

    return NextResponse.json({ ok: true, referral_code: code });
  }

  // Revoke ambassador
  if (action === 'revoke') {
    const amb = pm.ambassador as Record<string,unknown>;
    const updated = { ...pm, ambassador: { ...amb, is_ambassador: false, status: 'revoked', revoked_at: now } };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ profile_modules: updated }),
    });
    await sb('notification_events', {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ type: 'ambassador_revoked', target_user_id: user_id, metadata: { reason: data?.reason }, created_at: now }),
    });
    return NextResponse.json({ ok: true });
  }

  // Level upgrade
  if (action === 'upgrade_level') {
    const amb = pm.ambassador as Record<string,unknown>;
    const newLevel = data?.level || 'silver';
    const reward = { type: 'badge', name: `${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}-Badge`, granted_at: now };
    const rewards = Array.isArray(amb?.rewards) ? [...(amb.rewards as unknown[]), reward] : [reward];
    const updated = { ...pm, ambassador: { ...amb, level: newLevel, rewards } };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ profile_modules: updated }),
    });
    await sb('notification_events', {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ type: 'ambassador_level_upgrade', target_user_id: user_id, metadata: { new_level: newLevel }, created_at: now }),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
