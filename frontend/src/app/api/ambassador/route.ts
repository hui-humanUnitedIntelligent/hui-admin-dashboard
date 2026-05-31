// frontend/src/app/api/ambassador/route.ts
// ── Ambassador API — Manual-Only Activation ───────────────────────────────
// Ambassadors ONLY become active via admin approval or admin manual activation.
// No automatic promotion. Referral links are generated only after activation.

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

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
    body: JSON.stringify({
      type,
      actor_id:       actorId,
      target_user_id: targetId,
      entity_type:    'ambassador',
      metadata:       meta,
      created_at:     new Date().toISOString(),
    }),
  });
}

async function getProfile(userId: string) {
  const r = await sb(`profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,email,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules`);
  return Array.isArray(r.body) && r.body.length > 0 ? r.body[0] as Record<string, unknown> : null;
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const userId = searchParams.get('user_id');
  const query  = searchParams.get('q') || '';

  // ── List all ambassadors (active only) ───────────────────────────────
  if (action === 'list') {
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,role,is_wirker,impact_eur,follower_count,trust_score,created_at,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    const ambassadors = all
      .filter(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
        return amb?.is_ambassador === true && amb?.status === 'active';
      })
      .map(p => {
        const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
        return {
          id:               p.id, display_name: p.display_name, username: p.username,
          avatar_url:       p.avatar_url, role: p.role, is_wirker: p.is_wirker,
          trust_score:      p.trust_score, created_at: p.created_at,
          referral_code:    amb.referral_code, referral_link: amb.referral_link,
          level:            amb.level || 'bronze', status: 'active',
          activated_at:     amb.activated_at, activated_by: amb.activated_by,
          referral_count:   Number(amb.referral_count) || 0,
          revenue_generated:Number(amb.revenue_generated) || 0,
          link_active:      amb.link_active !== false,
          rewards:          amb.rewards || [],
        };
      });
    return NextResponse.json(ambassadors);
  }

  // ── List pending applications ─────────────────────────────────────────
  if (action === 'applications') {
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
          id: p.id, display_name: p.display_name, username: p.username,
          avatar_url: p.avatar_url, role: p.role, is_wirker: p.is_wirker,
          follower_count: p.follower_count, trust_score: p.trust_score,
          created_at: p.created_at, applied_at: amb.applied_at,
          motivation: amb.motivation || null,
        };
      });
    return NextResponse.json(apps);
  }

  // ── Ambassador detail ─────────────────────────────────────────────────
  if (action === 'detail' && userId) {
    const profile = await getProfile(userId);
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const amb = ((profile.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;

    // Referred users — profiles that have referred_by = this ambassador's code
    const refCode = amb?.referral_code as string;
    let referred: Record<string, unknown>[] = [];
    if (refCode) {
      const allProf = await sb(`profiles?select=id,display_name,username,avatar_url,created_at,profile_modules&limit=500`);
      referred = (Array.isArray(allProf.body) ? allProf.body as Record<string, unknown>[] : []).filter(p => {
        const pm = p.profile_modules as Record<string, unknown>;
        return pm?.referred_by === refCode;
      });
    }

    // Payments from referred users
    let totalRevenue = 0; let totalImpact = 0;
    if (referred.length > 0) {
      const ids = referred.map(p => p.id as string).join(',');
      const pays = await sb(`payments?payer_id=in.(${ids})&select=amount_eur,impact_amount&limit=1000`);
      if (Array.isArray(pays.body)) {
        for (const p of pays.body as Record<string, unknown>[]) {
          totalRevenue += Number(p.amount_eur) || 0;
          totalImpact  += Number(p.impact_amount) || 0;
        }
      }
    }

    // Recent ambassador log entries
    const logs = await sb(`notification_events?entity_type=eq.ambassador&or=(actor_id.eq.${userId},target_user_id.eq.${userId})&order=created_at.desc&limit=20`);

    return NextResponse.json({
      profile: { id: profile.id, display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url, role: profile.role, is_wirker: profile.is_wirker, trust_score: profile.trust_score, follower_count: profile.follower_count, created_at: profile.created_at },
      ambassador: { ...(amb || {}), referral_count: referred.length, revenue_generated: totalRevenue, impact_generated: totalImpact },
      referrals: referred.map(p => ({ id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url, joined_at: p.created_at })),
      logs: Array.isArray(logs.body) ? logs.body : [],
    });
  }

  // ── Stats for dashboard KPIs ──────────────────────────────────────────
  if (action === 'stats') {
    const r = await sb(`profiles?select=id,profile_modules&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    const active = all.filter(p => {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
      return amb?.is_ambassador === true && amb?.status === 'active';
    });
    const pending = all.filter(p => {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
      return amb?.status === 'pending';
    });
    let totalReferrals = 0; let totalRevenue = 0;
    const levelDist: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const p of active) {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown>;
      totalReferrals += Number(amb.referral_count) || 0;
      totalRevenue   += Number(amb.revenue_generated) || 0;
      const lvl = (amb.level as string) || 'bronze';
      levelDist[lvl] = (levelDist[lvl] || 0) + 1;
    }
    const netImpact = totalRevenue * 0.15 * 0.85;
    return NextResponse.json({
      active_ambassadors: active.length,
      pending_applications: pending.length,
      total_referrals: totalReferrals,
      total_revenue: totalRevenue,
      net_impact: netImpact,
      level_distribution: levelDist,
    });
  }

  // ── Search profiles (for admin user-search) ───────────────────────────
  if (action === 'search') {
    if (!query || query.length < 2) return NextResponse.json([]);
    const q = encodeURIComponent(query.toLowerCase());
    // Search by username, display_name, or email
    const r = await sb(`profiles?select=id,display_name,username,avatar_url,email,role,is_wirker,trust_score,created_at,profile_modules&or=(username.ilike.*${q}*,display_name.ilike.*${q}*,email.ilike.*${q}*)&limit=20`);
    const results = Array.isArray(r.body) ? r.body as Record<string, unknown>[] : [];
    return NextResponse.json(results.map(p => {
      const amb = ((p.profile_modules as Record<string, unknown>)?.ambassador) as Record<string, unknown> | undefined;
      return {
        id: p.id, display_name: p.display_name, username: p.username,
        avatar_url: p.avatar_url, email: p.email, role: p.role,
        is_wirker: p.is_wirker, trust_score: p.trust_score, created_at: p.created_at,
        ambassador_status: amb?.status || null,
        is_ambassador: amb?.is_ambassador === true,
      };
    }));
  }

  // ── Ambassador logs (audit trail) ────────────────────────────────────
  if (action === 'logs') {
    const r = await sb(`notification_events?entity_type=eq.ambassador&order=created_at.desc&limit=50`);
    return NextResponse.json(Array.isArray(r.body) ? r.body : []);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const body = await req.json();
  const { action, user_id, admin_id, data } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const profile = await getProfile(user_id);
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const pm  = (profile.profile_modules as Record<string, unknown>) || {};
  const amb = (pm.ambassador as Record<string, unknown>) || {};
  const now = new Date().toISOString();

  // ── Apply (user submits application) ─────────────────────────────────
  if (action === 'apply') {
    if (amb?.status === 'active') return NextResponse.json({ error: 'Already an ambassador' }, { status: 400 });
    const newAmb = { is_ambassador: false, status: 'pending', applied_at: now, motivation: data?.motivation || null, referral_code: null, referral_link: null, level: null, rewards: [], activated_by: null, activated_at: null, link_active: false };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: newAmb } }) });
    await logEvent('ambassador_application', user_id, null, { username: profile.username, motivation: data?.motivation });
    return NextResponse.json({ ok: true, message: 'Application submitted' });
  }

  // ── Approve (admin approves application → activates) ─────────────────
  if (action === 'approve') {
    const code = buildReferralCode(profile.username as string);
    const link = buildReferralLink(profile.username as string, user_id);
    const activatedAmb = { ...amb, is_ambassador: true, status: 'active', referral_code: code, referral_link: link, level: data?.level || 'bronze', activated_by: admin_id || 'admin', activated_at: now, link_active: true, rewards: [{ type: 'badge', name: 'Bronze-Badge', granted_at: now }] };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: activatedAmb } }) });
    await logEvent('ambassador_approved', user_id, admin_id, { referral_code: code, referral_link: link, level: activatedAmb.level });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  // ── Reject application ────────────────────────────────────────────────
  if (action === 'reject') {
    const rejected = { ...amb, is_ambassador: false, status: 'rejected', rejected_at: now, rejected_by: admin_id || 'admin', reject_reason: data?.reason || null };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: rejected } }) });
    await logEvent('ambassador_rejected', user_id, admin_id, { reason: data?.reason });
    return NextResponse.json({ ok: true });
  }

  // ── Manual activate (admin directly makes a user ambassador) ─────────
  if (action === 'activate') {
    const code = buildReferralCode(profile.username as string);
    const link = buildReferralLink(profile.username as string, user_id);
    const activated = { is_ambassador: true, status: 'active', applied_at: null, referral_code: code, referral_link: link, level: data?.level || 'bronze', activated_by: admin_id || 'admin', activated_at: now, link_active: true, rewards: [{ type: 'badge', name: 'Bronze-Badge', granted_at: now }], referral_count: 0, revenue_generated: 0 };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: activated } }) });
    await logEvent('ambassador_activated_by_admin', user_id, admin_id, { referral_code: code, referral_link: link });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  // ── Revoke ────────────────────────────────────────────────────────────
  if (action === 'revoke') {
    const revoked = { ...amb, is_ambassador: false, status: 'revoked', revoked_at: now, revoked_by: admin_id || 'admin', revoke_reason: data?.reason || null, link_active: false };
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: revoked } }) });
    await logEvent('ambassador_revoked', user_id, admin_id, { reason: data?.reason });
    return NextResponse.json({ ok: true });
  }

  // ── Toggle referral link active/inactive ──────────────────────────────
  if (action === 'toggle_link') {
    if (amb?.status !== 'active') return NextResponse.json({ error: 'Not an active ambassador' }, { status: 400 });
    const newActive = !amb.link_active;
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, link_active: newActive } } }) });
    await logEvent(newActive ? 'ambassador_link_enabled' : 'ambassador_link_disabled', user_id, admin_id, {});
    return NextResponse.json({ ok: true, link_active: newActive });
  }

  // ── Set level ─────────────────────────────────────────────────────────
  if (action === 'set_level') {
    if (amb?.status !== 'active') return NextResponse.json({ error: 'Not an active ambassador' }, { status: 400 });
    const newLevel = data?.level || 'bronze';
    const reward   = { type: 'badge', name: `${newLevel.charAt(0).toUpperCase() + newLevel.slice(1)}-Badge`, granted_at: now };
    const rewards  = Array.isArray(amb.rewards) ? [...(amb.rewards as unknown[]), reward] : [reward];
    await sb(`profiles?id=eq.${user_id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, level: newLevel, rewards } } }) });
    await logEvent('ambassador_level_changed', user_id, admin_id, { new_level: newLevel });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
