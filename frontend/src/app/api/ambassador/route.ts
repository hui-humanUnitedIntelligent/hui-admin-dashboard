// frontend/src/app/api/ambassador/route.ts
// ── Ambassador API — Admin-Side ───────────────────────────────
// Single Source of Truth:
//   profiles.is_ambassador (bool)  ← primär
//   profile_modules.ambassador     ← Statistiken + Status-Cache
//   ambassadors_applications       ← Bewerbungen (Tabelle existiert)
//   ambassador_ref_links           ← Referral-Links (Tabelle existiert)

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H    = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// ── Level + Rewards ────────────────────────────────────────────
const REWARD_RATES: Record<string, number> = {
  bronze: 0.01, silver: 0.02, gold: 0.03, platinum: 0.04,
};
function calcLevel(n: number): string {
  if (n >= 201) return 'platinum';
  if (n >= 51)  return 'gold';
  if (n >= 11)  return 'silver';
  return 'bronze';
}
function buildRefLink(username: string, userId: string): string {
  const clean = (username || '').replace(/[^a-zA-Z0-9._-]/g,'').toLowerCase();
  return clean.length >= 3 ? `https://be-hui.com/${clean}` : `https://be-hui.com/ref/${userId}`;
}
function buildRefCode(username: string): string {
  const base = (username||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5).padEnd(5,'X');
  const rnd  = Math.random().toString(36).toUpperCase().slice(2,5);
  return `AMB-${base}-${rnd}`;
}

// ── Supabase Helper ────────────────────────────────────────────
async function sb(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H, ...opts });
  const b = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body: b };
}
async function getProfile(userId: string) {
  const r = await sb(`profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,email,role,is_ambassador,is_talent,profile_modules,created_at`);
  return Array.isArray(r.body) && r.body.length > 0 ? r.body[0] as Record<string,unknown> : null;
}
async function logEvent(type: string, targetId: string|null, actorId: string|null, meta: Record<string,unknown>) {
  await sb('notification_events', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ type, actor_id: actorId, target_user_id: targetId,
      entity_type: 'ambassador', metadata: meta, created_at: new Date().toISOString() }),
  }).catch(() => {});
}

// ── GET ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const userId = searchParams.get('user_id') || '';
  const query  = searchParams.get('q') || '';

  // ── Aktive Ambassadors: profiles.is_ambassador = true ──────
  if (action === 'list') {
    const r = await sb(`profiles?is_ambassador=eq.true&select=id,display_name,username,avatar_url,role,is_talent,created_at,profile_modules&order=created_at.desc&limit=500`);
    const all = Array.isArray(r.body) ? r.body as Record<string,unknown>[] : [];
    // Ref-Links separat laden
    const refR = await sb(`ambassador_ref_links?select=user_id,ref_link,referral_code`);
    const refMap: Record<string,{ref_link:string;referral_code:string}> = {};
    if (Array.isArray(refR.body)) {
      for (const row of refR.body as Record<string,string>[]) {
        refMap[row.user_id] = { ref_link: row.ref_link, referral_code: row.referral_code };
      }
    }
    const ambassadors = all.map(p => {
      const amb = ((p.profile_modules as Record<string,unknown>)?.ambassador || {}) as Record<string,unknown>;
      const refCount = Number(amb.referral_count) || 0;
      const ref = refMap[p.id as string] || {};
      return {
        id: p.id, display_name: p.display_name, username: p.username,
        avatar_url: p.avatar_url, role: p.role, is_talent: p.is_talent,
        created_at: p.created_at,
        referral_code:           ref.referral_code || amb.referral_code || null,
        referral_link:           ref.ref_link      || amb.referral_link || null,
        level:                   calcLevel(refCount),
        status:                  'active',
        activated_at:            amb.activated_at  || null,
        referral_count:          refCount,
        active_referral_count:   Number(amb.active_referral_count)   || 0,
        sleeping_referral_count: Number(amb.sleeping_referral_count) || 0,
        revenue_generated:       Number(amb.revenue_generated)       || 0,
        link_active:             amb.link_active !== false,
      };
    });
    return NextResponse.json(ambassadors);
  }

  // ── Bewerbungen: aus ambassadors_applications ───────────────
  if (action === 'applications') {
    const r = await sb(
      `ambassadors_applications?status=eq.offen` +
      `&select=*,profiles!user_id(id,display_name,username,avatar_url,role,is_talent,created_at)` +
      `&order=created_at.desc&limit=200`
    );
    if (!r.ok || !Array.isArray(r.body)) {
      return NextResponse.json([]);
    }
    const apps = (r.body as Record<string,unknown>[]).map(a => {
      const prof = (a.profiles as Record<string,unknown>) || {};
      return {
        id:             a.id,
        user_id:        a.user_id,
        display_name:   prof.display_name || `${a.first_name} ${a.last_name}`,
        username:       prof.username     || null,
        avatar_url:     prof.avatar_url   || null,
        role:           prof.role         || 'user',
        is_talent:      prof.is_talent    || false,
        created_at:     prof.created_at   || a.created_at,
        applied_at:     a.created_at,
        first_name:     a.first_name,
        last_name:      a.last_name,
        age:            a.age,
        gender:         a.gender,
        location:       a.location,
        motivation_text:a.motivation_text,
        media_urls:     a.media_urls      || [],
        phone:          a.phone,
        email:          a.email,
        status:         a.status,
        source:         'application',
      };
    });
    return NextResponse.json(apps);
  }

  // ── Statistiken ─────────────────────────────────────────────
  if (action === 'stats') {
    const [actR, appR] = await Promise.all([
      sb(`profiles?is_ambassador=eq.true&select=id,profile_modules`),
      sb(`ambassadors_applications?status=eq.offen&select=id`),
    ]);
    const active = Array.isArray(actR.body) ? actR.body as Record<string,unknown>[] : [];
    let totalReferrals = 0, totalRevenue = 0;
    const levelDist: Record<string,number> = { bronze:0, silver:0, gold:0, platinum:0 };
    for (const p of active) {
      const amb = ((p.profile_modules as Record<string,unknown>)?.ambassador || {}) as Record<string,unknown>;
      const refCount = Number(amb.referral_count) || 0;
      totalReferrals += refCount;
      totalRevenue   += Number(amb.revenue_generated) || 0;
      levelDist[calcLevel(refCount)] = (levelDist[calcLevel(refCount)] || 0) + 1;
    }
    return NextResponse.json({
      active_ambassadors:   active.length,
      pending_applications: Array.isArray(appR.body) ? appR.body.length : 0,
      total_referrals:      totalReferrals,
      total_revenue:        totalRevenue,
      net_impact:           totalRevenue * 0.15,
      level_distribution:   levelDist,
    });
  }

  // ── Detail ────────────────────────────────────────────────────
  if (action === 'detail' && userId) {
    const [profR, refR, appR, refUsersR] = await Promise.all([
      sb(`profiles?id=eq.${userId}&select=*`),
      sb(`ambassador_ref_links?user_id=eq.${userId}&select=*`),
      sb(`ambassadors_applications?user_id=eq.${userId}&select=*&order=created_at.desc&limit=5`),
      // Referrals aus beiden Quellen: ambassador_id (primär) + refCode (Fallback)
      sb(`profiles?referred_by_ambassador_id=eq.${userId}&select=id,display_name,username,avatar_url,is_talent,created_at&order=created_at.desc&limit=200`),
    ]);
    // E-Mail aus auth.users holen (profiles.email kann null sein)
    let authEmail: string | null = null;
    try {
      const authR = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`,
        { headers: { ...H, Authorization: `Bearer ${KEY}` } });
      if (authR.ok) {
        const authUser = await authR.json() as { email?: string };
        authEmail = authUser.email || null;
      }
    } catch {}
    const rawProfile = Array.isArray(profR.body) ? profR.body[0] as Record<string,unknown> : null;
    const profile = rawProfile ? { ...rawProfile, email: rawProfile.email || authEmail } : null;
    const refLinks = Array.isArray(refR.body)  ? refR.body     : [];
    const apps     = Array.isArray(appR.body)  ? appR.body     : [];
    const rawRefs  = Array.isArray(refUsersR.body) ? refUsersR.body as Record<string,unknown>[] : [];
    // Aktiv = Profil ausgefüllt (display_name + avatar) ODER is_talent
    const referrals = rawRefs.map(p => ({
      id:          p.id,
      display_name:p.display_name || p.username || "Nutzer",
      username:    p.username  || null,
      avatar_url:  p.avatar_url || null,
      is_active:   p.is_talent === true || (!!p.display_name && !!p.avatar_url),
      joined_at:   p.created_at,
    }));
    const activeCount   = referrals.filter(r => r.is_active).length;
    const sleepingCount = referrals.filter(r => !r.is_active).length;
    return NextResponse.json({ profile, refLinks, applications: apps, referrals,
      stats: { total: referrals.length, active: activeCount, sleeping: sleepingCount } });
  }

  // ── Suche ─────────────────────────────────────────────────────
  if (action === 'search' && query) {
    const r = await sb(
      `profiles?or=(display_name.ilike.*${query}*,username.ilike.*${query}*)` +
      `&select=id,display_name,username,avatar_url,role,is_ambassador,is_talent,created_at` +
      `&limit=30`
    );
    const results = (Array.isArray(r.body) ? r.body as Record<string,unknown>[] : []).map(p => ({
      ...p,
      ambassador_status: p.is_ambassador ? 'active' : null,
    }));
    return NextResponse.json(results);
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}

// ── POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const data       = await req.json().catch(() => ({}));
  const action     = data.action     as string;
  const user_id    = data.user_id    as string;
  const admin_id   = data.admin_id   as string | undefined;
  const now        = new Date().toISOString();

  if (!user_id) return NextResponse.json({ error: 'user_id fehlt' }, { status: 400 });

  const profile = await getProfile(user_id);
  if (!profile) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 });

  const pm  = (profile.profile_modules as Record<string,unknown>) || {};
  const amb = (pm.ambassador as Record<string,unknown>) || {};

  // ── APPROVE: Bewerbung annehmen ─────────────────────────────
  if (action === 'approve') {
    const code = buildRefCode(profile.username as string);
    const link = buildRefLink(profile.username as string, user_id);

    // 1. profiles: is_ambassador = true + profile_modules aktualisieren
    const newAmb = {
      ...amb,
      is_ambassador:           true,
      status:                  'active',
      referral_code:           code,
      referral_link:           link,
      level:                   'bronze',
      activated_by:            admin_id || 'admin',
      activated_at:            now,
      link_active:             true,
      referral_count:          Number(amb.referral_count) || 0,
      active_referral_count:   Number(amb.active_referral_count) || 0,
      sleeping_referral_count: Number(amb.sleeping_referral_count) || 0,
      revenue_generated:       Number(amb.revenue_generated) || 0,
    };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_ambassador: true, profile_modules: { ...pm, ambassador: newAmb } }),
    });

    // 2. Ref-Link anlegen
    await sb(`ambassador_ref_links`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id, username: profile.username, ref_link: link, referral_code: code }),
    });

    // 3. Bewerbung als angenommen markieren
    const appId = data.application_id as string | undefined;
    if (appId) {
      await sb(`ambassadors_applications?id=eq.${appId}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'angenommen', reviewed_at: now, reviewed_by: admin_id || 'admin' }),
      });
    } else {
      await sb(`ambassadors_applications?user_id=eq.${user_id}&status=eq.offen`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'angenommen', reviewed_at: now, reviewed_by: admin_id || 'admin' }),
      });
    }
    await logEvent('ambassador_approved', user_id, admin_id||null, { referral_code: code, referral_link: link });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  // ── REJECT ─────────────────────────────────────────────────
  if (action === 'reject') {
    const newAmb = { ...amb, is_ambassador: false, status: 'abgelehnt',
      rejected_at: now, rejected_by: admin_id||'admin', reject_reason: data.reason||null };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_ambassador: false, profile_modules: { ...pm, ambassador: newAmb } }),
    });
    const appId = data.application_id as string | undefined;
    if (appId) {
      await sb(`ambassadors_applications?id=eq.${appId}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'abgelehnt', reviewed_at: now, reviewed_by: admin_id||'admin' }),
      });
    } else {
      await sb(`ambassadors_applications?user_id=eq.${user_id}&status=eq.offen`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'abgelehnt', reviewed_at: now, reviewed_by: admin_id||'admin' }),
      });
    }
    await logEvent('ambassador_rejected', user_id, admin_id||null, { reason: data.reason });
    return NextResponse.json({ ok: true });
  }

  // ── REVOKE: Ambassador-Status entziehen ─────────────────────
  if (action === 'revoke') {
    const newAmb = { ...amb, is_ambassador: false, status: 'widerrufen',
      revoked_at: now, revoked_by: admin_id||'admin' };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_ambassador: false, profile_modules: { ...pm, ambassador: newAmb } }),
    });
    // Ref-Link deaktivieren (löschen oder link_active = false)
    await sb(`ambassador_ref_links?user_id=eq.${user_id}`, {
      method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' },
    });
    await logEvent('ambassador_revoked', user_id, admin_id||null, {});
    return NextResponse.json({ ok: true });
  }

  // ── ACTIVATE: Direkt ohne Bewerbung als Ambassador setzen ───
  if (action === 'activate') {
    const code = buildRefCode(profile.username as string);
    const link = buildRefLink(profile.username as string, user_id);
    const newAmb = {
      is_ambassador: true, status: 'active',
      referral_code: code, referral_link: link, level: 'bronze',
      activated_by: admin_id||'admin', activated_at: now,
      link_active: true, referral_count: 0,
      active_referral_count: 0, sleeping_referral_count: 0, revenue_generated: 0,
    };
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_ambassador: true, profile_modules: { ...pm, ambassador: newAmb } }),
    });
    await sb(`ambassador_ref_links`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id, username: profile.username, ref_link: link, referral_code: code }),
    });
    await logEvent('ambassador_activated_by_admin', user_id, admin_id||null, { referral_code: code });
    return NextResponse.json({ ok: true, referral_code: code, referral_link: link });
  }

  // ── TOGGLE LINK ─────────────────────────────────────────────
  if (action === 'toggle_link') {
    const newActive = !amb.link_active;
    await sb(`profiles?id=eq.${user_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ profile_modules: { ...pm, ambassador: { ...amb, link_active: newActive } } }),
    });
    return NextResponse.json({ ok: true, link_active: newActive });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
