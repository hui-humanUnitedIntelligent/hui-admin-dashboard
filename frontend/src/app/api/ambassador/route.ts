// frontend/src/app/api/ambassador/route.ts
// ── Ambassador API — Manual-Only Activation ───────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// ── Reward-Konfiguration (zentral anpassbar) ──────────────────────────────
const AMBASSADOR_REWARD_RATES: Record<string, number> = {
  bronze:   0.01,
  silver:   0.02,
  gold:     0.03,
  platinum: 0.04,
};
const IMPACT_POOL_RATE = 0.15;

// ── Level-Berechnung ─────────────────────────────────────────────────────
function calcLevel(referralsCount: number): string {
  const n = Number(referralsCount) || 0;
  if (n >= 201) return 'platinum';
  if (n >= 51)  return 'gold';
  if (n >= 11)  return 'silver';
  return 'bronze';
}

function calcReward(amountTotal: number, level: string) {
  const rate = AMBASSADOR_REWARD_RATES[level] ?? AMBASSADOR_REWARD_RATES.bronze;
  return {
    ambassador_share: amountTotal * rate,
    impact_share:     amountTotal * IMPACT_POOL_RATE,
    rate,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function sb(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H, ...opts });
  const b = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body: b };
}

function buildReferralLink(username: string, userId: string): string {
  const clean = (username || '').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  if (clean && clean.length >= 3) return `https://be-hui.com/${clean}`;
  return `https://be-hui.com/ref/${userId}`;
}

function buildReferralCode(username: string): string {
  const base = (username || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5).padEnd(5, 'X');
  const rnd  = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `AMB-${base}-${rnd}`;
}

async function logEvent(type: string, targetId: string | null, actorId: string | null, meta: Record<string, unknown>) {
  await sb('notification_events', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ type, actor_id: actorId, target_user_id: targetId, entity_type: 'ambassador', metadata: meta, created_at: new Date().toISOString() }),
  });
}

async function getProfile(userId: string) {
  const r = await sb(`profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,email,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules,is_ambassador`);
  return Array.isArray(r.body) && r.body.length > 0 ? r.body[0] as Record<string, unknown> : null;
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const userId = searchParams.get('user_id');
  const query  = searchParams.get('q') || '';

  if (action === 'list') {
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules,is_ambassador&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    const ambassadors = all
      .filter(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
        return amb?.is_ambassador === true && amb?.status === 'active';
      })
      .map(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
        const refCount = Number(amb.referral_count) || 0;
        return {
          id: p.id, display_name: p.display_name, username: p.username,
          avatar_url: p.avatar_url, role: p.role, is_wirker: p.is_wirker,
          trust_score: p.trust_score, created_at: p.created_at,
          referral_code: amb.referral_code, referral_link: amb.referral_link,
          level: calcLevel(refCount), status: 'active',
          activated_at: amb.activated_at, activated_by: amb.activated_by,
          referral_count: refCount,
          active_referral_count:   Number(amb.active_referral_count)   || 0,
          sleeping_referral_count: Number(amb.sleeping_referral_count) || 0,
          revenue_generated: Number(amb.revenue_generated) || 0,
          link_active: amb.link_active !== false,
          rewards: amb.rewards || [],
        };
      });
    return NextResponse.json(ambassadors);
  }

  if (action === 'applications') {
    const appR = await sb(`ambassadors_applications?status=eq.offen&select=*,profiles!user_id(id,display_name,username,avatar_url,role,is_wirker,follower_count,trust_score,created_at)&order=created_at.desc&limit=200`);
    if (appR.ok && Array.isArray(appR.body) && appR.body.length > 0) {
      const apps = (appR.body as Record<string, unknown>[]).map(a => {
        const prof = a.profiles as Record<string, unknown> | null;
        return {
          id: a.id, user_id: a.user_id,
          first_name: a.first_name, last_name: a.last_name,
          display_name: prof?.display_name || `${a.first_name} ${a.last_name}`,
          username: prof?.username, avatar_url: prof?.avatar_url,
          role: prof?.role, is_wirker: prof?.is_wirker,
          follower_count: prof?.follower_count, trust_score: prof?.trust_score,
          age: a.age, gender: a.gender, location: a.location,
          motivation_text: a.motivation_text,
          media_urls: a.media_urls || [],
          phone: a.phone || null,
          email: a.email || null,
          status: a.status, created_at: a.created_at, source: 'table',
        };
      });
      return NextResponse.json(apps);
    }
    // Fallback: profile_modules
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,role,is_wirker,follower_count,trust_score,created_at,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    const apps = all
      .filter(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
        return amb?.status === 'pending';
      })
      .map(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
        return {
          id: p.id, user_id: p.id,
          display_name: p.display_name, username: p.username,
          avatar_url: p.avatar_url, role: p.role, is_wirker: p.is_wirker,
          follower_count: p.follower_count, trust_score: p.trust_score,
          created_at: p.created_at, applied_at: amb.applied_at,
          motivation_text: (amb.motivation as string) || null,
          first_name: amb.first_name as string || null,
          last_name: amb.last_name as string || null,
          age: amb.age as number || null, gender: amb.gender as string || null,
          location: amb.location as string || null,
          media_urls: (amb.media_urls as unknown[]) || [],
          source: 'profile_modules',
        };
      });
    return NextResponse.json(apps);
  }

  if (action === 'detail' && userId) {
    const profile = await getProfile(userId);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // E-Mail aus auth.users via Admin-API holen (zuverlässiger als profiles.email)
    let authEmail: string | null = null;
    try {
      const authRes = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
      });
      if (authRes.ok) {
        const authUser = await authRes.json();
        authEmail = authUser?.email || null;
      }
    } catch { /* ignore */ }
    const amb = ((profile.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
    const refCode = amb?.referral_code as string;
    let referred: Record<string, unknown>[] = [];
    if (refCode) {
      const allProf = await sb(`profiles?select=id,display_name,username,avatar_url,created_at,profile_modules&limit=500`);
      referred = (Array.isArray(allProf.body) ? allProf.body as Record<string, unknown>[] : []).filter(p => {
        const pm = p.profile_modules as Record<string, unknown>;
        return pm?.referred_by === refCode;
      });
    }
    const revR = await sb(`ambassador_revenue?ambassador_user_id=eq.${userId}&select=ambassador_share,impact_share&limit=1000`);
    let totalAmbShare = 0; let totalImpactShare = 0;
    if (Array.isArray(revR.body)) {
      for (const rv of revR.body as Record<string, unknown>[]) {
        totalAmbShare   += Number(rv.ambassador_share) || 0;
        totalImpactShare += Number(rv.impact_share)    || 0;
      }
    }
    const logs = await sb(`notification_events?entity_type=eq.ambassador&or=(actor_id.eq.${userId},target_user_id.eq.${userId})&order=created_at.desc&limit=20`);
    // Bewerbungsdaten (phone + email) aus ambassadors_applications laden
    const appR = await sb(`ambassadors_applications?user_id=eq.${userId}&select=phone,email&order=created_at.desc&limit=1`);
    const appData = (Array.isArray(appR.body) && appR.body.length > 0) ? appR.body[0] as Record<string,unknown> : {};
    return NextResponse.json({
      profile: { id: profile.id, display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url, email: authEmail || profile.email || null, phone: (profile as Record<string,unknown>).phone as string || appData.phone as string || null, role: profile.role, is_wirker: profile.is_wirker, trust_score: profile.trust_score, follower_count: profile.follower_count, created_at: profile.created_at },
      ambassador: { ...(amb || {}), referral_count: referred.length, revenue_generated: totalAmbShare, impact_generated: totalImpactShare, level: calcLevel(referred.length) },
      referrals: referred.map(p => ({ id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url, joined_at: p.created_at })),
      logs: Array.isArray(logs.body) ? logs.body : [],
    });
  }

  if (action === 'stats') {
    const r = await sb(`profiles?select=id,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    const active = all.filter(p => {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
      return amb?.is_ambassador === true && amb?.status === 'active';
    });
    const pendingR = await sb(`ambassadors_applications?status=eq.offen&select=id`);
    let pendingCount = Array.isArray(pendingR.body) ? pendingR.body.length : 0;
    if (!pendingR.ok || pendingCount === 0) {
      pendingCount = all.filter(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
        return amb?.status === 'pending';
      }).length;
    }
    const revR = await sb(`ambassador_revenue?select=ambassador_share,impact_share&limit=10000`);
    let totalRevenue = 0; let totalImpact = 0;
    if (Array.isArray(revR.body)) {
      for (const rv of revR.body as Record<string, unknown>[]) {
        totalRevenue += Number(rv.ambassador_share) || 0;
        totalImpact  += Number(rv.impact_share)     || 0;
      }
    }
    if (totalRevenue === 0) {
      for (const p of active) {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
        totalRevenue += Number(amb.revenue_generated) || 0;
      }
      totalImpact = totalRevenue * IMPACT_POOL_RATE;
    }
    let totalReferrals = 0;
    const levelDist: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const p of active) {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
      const refs = Number(amb.referral_count) || 0;
      totalReferrals += refs;
      const lvl = calcLevel(refs);
      levelDist[lvl] = (levelDist[lvl] || 0) + 1;
    }
    return NextResponse.json({ active_ambassadors: active.length, pending_applications: pendingCount, total_referrals: totalReferrals, total_revenue: totalRevenue, net_impact: totalImpact, level_distribution: levelDist });
  }

  if (action === 'search') {
    if (!query || query.length < 2) return NextResponse.json([]);
    const q = encodeURIComponent(query.toLowerCase());
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,email,role,is_wirker,trust_score,created_at,profile_modules&or=(username.ilike.*${q}*,display_name.ilike.*${q}*,email.ilike.*${q}*)&limit=20`);
    const results = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    return NextResponse.json(results.map(p => {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
      return { id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url, email: p.email, role: p.role, is_wirker: p.is_wirker, trust_score: p.trust_score, created_at: p.created_at, ambassador_status: amb?.status || null, is_ambassador: amb?.is_ambassador === true };
    }));
  }

  if (action === 'logs') {
    const r = await sb(`notification_events?entity_type=eq.ambassador&order=created_at.desc&limit=100`);
    return NextResponse.json(Array.isArray(r.body) ? r.body : []);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const { action, user_id, admin_id, data } = body as { action: string; user_id: string; admin_id?: string; data?: Record<string, unknown> };
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  const profile = await getProfile(user_id);
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const pm  = (profile.profile_modules as Record<string, unknown>) || {};
  const amb = (pm.ambassador as Record<string, unknown>) || {};
  const now = new Date().toISOString();

  if (action === 'apply') {
    if (amb?.status === 'active') return NextResponse.json({ error: 'Already an ambassador' }, { status: 400 });
    const newAmb = { is_ambassador: false, status: 'pending', applied_at: now, motivation: data?.motivation || null, first_name: data?.first_name, last_name: data?.last_name, age: data?.age, gender: data?.gender, location: data?.location, media_urls: data?.media_urls || [], referral_code: null, referral_link: null, level: null, rewards: [], activated_by: null, activated_at: null, link_active: false };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: newAmb } }) });
    await logEvent('ambassador_application', user_id, null, { username: profile.username, motivation: data?.motivation });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    const code = buildReferralCode(profile.username as string);
    const link = buildReferralLink(profile.username as string, user_id);
    const activatedAmb = { ...amb, is_ambassador: true, status: 'active', referral_code: code, referral_link: link, level: 'bronze', activated_by: admin_id || 'admin', activated_at: now, link_active: true, referral_count: 0, active_referral_count: 0, sleeping_referral_count: 0, revenue_generated: 0, rewards: [{ type: 'badge', name: 'Bronze-Badge', granted_at: now }] };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: activatedAmb }, is_ambassador: true }) });
    // Ref-Link-Eintrag anlegen (eindeutig, unveränderbar)
    await sb(`ambassador_ref_links`, { method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id, username: profile.username, ref_link: link, referral_code: code }) });
    const appId = data?.application_id as string;
    if (appId) await sb(`ambassadors_applications?id=eq.${appId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'angenommen', reviewed_at: now }) });
    else       await sb(`ambassadors_applications?user_id=eq.${user_id}&status=eq.offen`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'angenommen', reviewed_at: now }) });
    await logEvent('ambassador_approved', user_id, admin_id || null, { referral_code: code, referral_link: link, level: 'bronze' });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  if (action === 'reject') {
    const rejected = { ...amb, is_ambassador: false, status: 'rejected', rejected_at: now, rejected_by: admin_id || 'admin', reject_reason: data?.reason || null };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: rejected } }) });
    const appId = data?.application_id as string;
    if (appId) await sb(`ambassadors_applications?id=eq.${appId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'abgelehnt', reviewed_at: now }) });
    else       await sb(`ambassadors_applications?user_id=eq.${user_id}&status=eq.offen`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'abgelehnt', reviewed_at: now }) });
    await logEvent('ambassador_rejected', user_id, admin_id || null, { reason: data?.reason });
    return NextResponse.json({ ok: true });
  }

  if (action === 'activate') {
    const code = buildReferralCode(profile.username as string);
    const link = buildReferralLink(profile.username as string, user_id);
    const activated = { is_ambassador: true, status: 'active', referral_code: code, referral_link: link, level: data?.level || 'bronze', activated_by: admin_id || 'admin', activated_at: now, link_active: true, referral_count: 0, active_referral_count: 0, sleeping_referral_count: 0, revenue_generated: 0, rewards: [{ type: 'badge', name: 'Bronze-Badge', granted_at: now }] };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: activated }, is_ambassador: true }) });
    await logEvent('ambassador_activated_by_admin', user_id, admin_id || null, { referral_code: code, referral_link: link });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  if (action === 'revoke') {
    const revoked = { ...amb, is_ambassador: false, status: 'revoked', revoked_at: now, revoked_by: admin_id || 'admin', revoke_reason: data?.reason || null, link_active: false };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: revoked }, is_ambassador: false }) });
    // Ref-Link-Eintrag löschen (C — automatische Löschung bei Entzug)
    await sb(`ambassador_ref_links?user_id=eq.${user_id}`, { method: 'DELETE', headers: H });
    await logEvent('ambassador_revoked', user_id, admin_id || null, { reason: data?.reason });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle_link') {
    if (amb?.status !== 'active') return NextResponse.json({ error: 'Not an active ambassador' }, { status: 400 });
    const newActive = !amb.link_active;
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, link_active: newActive } } }) });
    await logEvent(newActive ? 'ambassador_link_enabled' : 'ambassador_link_disabled', user_id, admin_id || null, {});
    return NextResponse.json({ ok: true, link_active: newActive });
  }

  if (action === 'set_level') {
    if (amb?.status !== 'active') return NextResponse.json({ error: 'Not an active ambassador' }, { status: 400 });
    const newLevel = (data?.level as string) || 'bronze';
    const reward   = { type: 'badge', name: `${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}-Badge`, granted_at: now };
    const rewards  = Array.isArray(amb.rewards) ? [...(amb.rewards as unknown[]), reward] : [reward];
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, level: newLevel, rewards } } }) });
    await logEvent('ambassador_level_changed', user_id, admin_id || null, { new_level: newLevel });
    return NextResponse.json({ ok: true });
  }

  if (action === 'track_revenue') {
    if (amb?.status !== 'active') return NextResponse.json({ error: 'Not an active ambassador' }, { status: 400 });
    const amountTotal = Number(data?.amount_total) || 0;
    const refCount    = Number(amb.referral_count) || 0;
    const level       = calcLevel(refCount);
    const { ambassador_share, impact_share } = calcReward(amountTotal, level);
    await sb('ambassador_revenue', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ ambassador_user_id: user_id, referred_user_id: data?.referred_user_id || null, transaction_id: data?.transaction_id || null, amount_total: amountTotal, impact_share, ambassador_share, ambassador_level: level }) });
    const currentRevenue = Number(amb.revenue_generated) || 0;
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, revenue_generated: currentRevenue + ambassador_share, level } } }) });
    return NextResponse.json({ ok: true, ambassador_share, impact_share, level });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
