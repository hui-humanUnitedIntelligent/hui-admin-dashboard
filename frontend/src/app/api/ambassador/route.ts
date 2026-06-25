// frontend/src/app/api/ambassador/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, notFound, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';
import { calcLevel, buildRefCode, buildRefLink, computeAmbassadorMetrics, rewardForLevelUp } from '@/lib/ambassador-engine';

// Helpers: buildRefCode, buildRefLink, calcLevel → @/lib/ambassador-engine

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const params = new URL(req.url).searchParams;
    const action = params.get('action') || 'list';
    const userId = params.get('userId') || params.get('user_id');
    const query  = params.get('query');

    if (action === 'list') {
      const [{ data: profiles }, { data: refLinks }] = await Promise.all([
        sb.from('profiles').select('id,display_name,username,avatar_url,role,is_talent,created_at,profile_modules')
          .eq('is_ambassador', true).order('created_at', { ascending: false }).limit(500),
        sb.from('ambassador_ref_links').select('user_id,ref_link,referral_code'),
      ]);
      const refMap: Record<string, { ref_link: string; referral_code: string }> = {};
      for (const r of (refLinks ?? [])) refMap[r.user_id] = r as { ref_link: string; referral_code: string };

      const ambassadors = (profiles ?? []).map(p => {
        const amb      = ((p.profile_modules as Record<string,unknown>)?.ambassador || {}) as Record<string,unknown>;
        const refCount = Number(amb.referralCount ?? amb.referral_count) || 0;
        const ref      = refMap[p.id] ?? {};
        return {
          id: p.id, displayName: p.display_name, username: p.username,
          avatarUrl: p.avatar_url, role: p.role, isTalent: p.is_talent, createdAt: p.created_at,
          referralCode:          ref.referral_code     ?? amb.referral_code  ?? null,
          referralLink:          ref.ref_link          ?? amb.referral_link  ?? null,
          level:                 calcLevel(refCount),
          status:                'active',
          activatedAt:           amb.activated_at      ?? null,
          referralCount:         refCount,
          activeReferralCount:   Number(amb.active_referral_count)   || 0,
          sleepingReferralCount: Number(amb.sleeping_referral_count) || 0,
          revenueGenerated:      Number(amb.revenue_generated)       || 0,
          linkActive:            amb.link_active !== false,
        };
      });
      return ok(ambassadors);
    }

    if (action === 'applications') {
      const { data, error } = await sb.from('ambassadors_applications')
        .select('*,profiles!user_id(id,display_name,username,avatar_url,role,is_talent,created_at)')
        .eq('status', 'offen').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const apps = (data ?? []).map(a => {
        const prof = (a.profiles as Record<string,unknown>) ?? {};
        return {
          id: a.id, userId: a.user_id,
          displayName: prof.display_name ?? `${a.first_name} ${a.last_name}`,
          username: prof.username ?? null, avatarUrl: prof.avatar_url ?? null,
          role: prof.role ?? 'user', isTalent: prof.is_talent ?? false,
          createdAt: prof.created_at ?? a.created_at, appliedAt: a.created_at,
          firstName: a.first_name, lastName: a.last_name, age: a.age,
          gender: a.gender, location: a.location, motivationText: a.motivation_text,
          mediaUrls: a.media_urls ?? [], phone: a.phone, email: a.email, status: a.status,
        };
      });
      return ok(apps);
    }

    if (action === 'stats') {
      const [{ data: active }, { data: apps }] = await Promise.all([
        sb.from('profiles').select('id,profile_modules').eq('is_ambassador', true),
        sb.from('ambassadors_applications').select('id').eq('status', 'offen'),
      ]);
      let totalReferrals = 0, totalRevenue = 0;
      const levelDist: Record<string,number> = { bronze:0, silver:0, gold:0, platinum:0 };
      for (const p of (active ?? [])) {
        const amb = ((p.profile_modules as Record<string,unknown>)?.ambassador || {}) as Record<string,unknown>;
        const n   = Number(amb.referral_count) || 0;
        totalReferrals += n; totalRevenue += Number(amb.revenue_generated) || 0;
        const lvl = calcLevel(n);
        levelDist[lvl] = (levelDist[lvl] || 0) + 1;
      }
      return ok({ activeAmbassadors: (active ?? []).length, pendingApplications: (apps ?? []).length, totalReferrals, totalRevenue, netImpact: totalRevenue * 0.15, levelDistribution: levelDist });
    }

    if (action === 'search' && query) {
      const { data, error } = await sb.from('profiles')
        .select('id,display_name,username,avatar_url,role,is_ambassador,is_talent,created_at')
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`).limit(30);
      if (error) throw error;
      return ok((data ?? []).map(p => ({ ...p, ambassadorStatus: p.is_ambassador ? 'active' : null })));
    }

    if (action === 'detail' && userId) {
      const [{ data: profiles }, { data: refLinks }, { data: referrals }] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).limit(1),
        sb.from('ambassador_ref_links').select('*').eq('user_id', userId),
        sb.from('profiles').select('id,display_name,username,avatar_url,is_talent,created_at')
          .eq('referred_by_ambassador_id', userId).order('created_at', { ascending: false }).limit(200),
      ]);
      const profile = profiles?.[0] ?? null;
      const refs    = (referrals ?? []).map(p => ({
        id: p.id, displayName: p.display_name ?? p.username ?? 'Nutzer',
        username: p.username, avatarUrl: p.avatar_url,
        isActive: p.is_talent === true || (!!p.display_name && !!p.avatar_url), joinedAt: p.created_at,
      }));
      return ok({ profile, refLinks: refLinks ?? [], referrals: refs, stats: { total: refs.length, active: refs.filter(r => r.isActive).length, sleeping: refs.filter(r => !r.isActive).length } });
    }

    return fail(`Unbekannte Aktion: ${action}`);
  } catch (err) { return serverError(err, 'ambassador GET'); }
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const data     = await req.json().catch(() => ({}));
    const { action, user_id: userId, admin_id: adminId } = data as { action?: string; user_id?: string; admin_id?: string };

    if (!userId) return validationError({ userId: 'Pflichtfeld' });
    if (!action) return validationError({ action: 'Pflichtfeld' });

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    const { data: profiles } = await sb.from('profiles').select('*').eq('id', userId).limit(1);
    const profile = profiles?.[0] as Record<string,unknown> | undefined;
    if (!profile) return notFound('Profil');

    const pm  = (profile.profile_modules as Record<string,unknown>) ?? {};
    const amb = (pm.ambassador as Record<string,unknown>) ?? {};

    const logEvent = async (type: string, meta: Record<string,unknown>, before?: unknown, after?: unknown) => {
      try {
        await sb.from('activity_logs').insert({
          action:     type,
          target_id:  userId,
          actor_id:   adminId ?? null,
          metadata:   { ...meta, before: before ?? null, after: after ?? null },
          created_at: now,
        });
      } catch (_) {}
    };

    switch (action) {
      case 'approve':
      case 'activate': {
        const refCode = buildRefCode(profile.username as string);
        const refLink = buildRefLink(profile.username as string, userId);
        const before  = { is_ambassador: profile.is_ambassador, status: amb.status ?? null };
        const newAmb  = { ...amb, is_ambassador: true, status: 'active', referral_code: refCode, referral_link: refLink, level: 'bronze', activated_by: adminId ?? 'admin', activated_at: now, link_active: true, referral_count: Number(amb.referral_count)||0, revenue_generated: Number(amb.revenue_generated)||0 };
        const after   = { is_ambassador: true, status: 'active', level: 'bronze' };
        await sb.from('profiles').update({ is_ambassador: true, profile_modules: { ...pm, ambassador: newAmb } }).eq('id', userId);
        await sb.from('ambassador_ref_links').upsert({ user_id: userId, username: profile.username, ref_link: refLink, referral_code: refCode }, { onConflict: 'user_id' });
        if (action === 'approve') {
          const appId  = data.application_id as string | undefined;
          const update = { status: 'angenommen', reviewed_at: now, reviewed_by: adminId ?? 'admin' };
          if (appId) await sb.from('ambassadors_applications').update(update).eq('id', appId);
          else       await sb.from('ambassadors_applications').update(update).eq('user_id', userId).eq('status', 'offen');
        }
        await logEvent(`ambassador_${action === 'approve' ? 'approved' : 'activated'}`, { referralCode: refCode, referralLink: refLink }, before, after);
        return ok({ referralCode: refCode, referralLink: refLink });
      }
      case 'reject': {
        const before  = { is_ambassador: profile.is_ambassador, status: amb.status };
        const newAmb  = { ...amb, is_ambassador: false, status: 'abgelehnt', rejected_at: now, rejected_by: adminId ?? 'admin', reject_reason: data.reason ?? null };
        const after   = { is_ambassador: false, status: 'abgelehnt' };
        await sb.from('profiles').update({ is_ambassador: false, profile_modules: { ...pm, ambassador: newAmb } }).eq('id', userId);
        const appId  = data.application_id as string | undefined;
        const update = { status: 'abgelehnt', reviewed_at: now, reviewed_by: adminId ?? 'admin' };
        if (appId) await sb.from('ambassadors_applications').update(update).eq('id', appId);
        else       await sb.from('ambassadors_applications').update(update).eq('user_id', userId).eq('status', 'offen');
        await logEvent('ambassador_rejected', { reason: data.reason ?? null }, before, after);
        return ok({ rejected: true });
      }
      case 'revoke': {
        const before  = { is_ambassador: profile.is_ambassador, status: amb.status, level: amb.level };
        const newAmb  = { ...amb, is_ambassador: false, status: 'widerrufen', revoked_at: now, revoked_by: adminId ?? 'admin' };
        const after   = { is_ambassador: false, status: 'widerrufen' };
        await sb.from('profiles').update({ is_ambassador: false, profile_modules: { ...pm, ambassador: newAmb } }).eq('id', userId);
        await sb.from('ambassador_ref_links').delete().eq('user_id', userId);
        await logEvent('ambassador_revoked', { revokedBy: adminId }, before, after);
        return ok({ revoked: true });
      }
      case 'toggle_link': {
        const newActive = !amb.link_active;
        const before    = { link_active: amb.link_active };
        const after     = { link_active: newActive };
        await sb.from('profiles').update({ profile_modules: { ...pm, ambassador: { ...amb, link_active: newActive } } }).eq('id', userId);
        await logEvent('ambassador_link_toggled', { linkActive: newActive }, before, after);
        return ok({ linkActive: newActive });
      }
      default: return fail(`Unbekannte Aktion: ${action}`);
    }
  } catch (err) { return serverError(err, 'ambassador POST'); }
}
