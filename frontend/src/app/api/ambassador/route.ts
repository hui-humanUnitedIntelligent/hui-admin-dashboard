// frontend/src/app/api/ambassador/route.ts
// Ambassador-API — ARCH-006.1
// Ambassadors = profiles WHERE (role = 'ambassador' OR is_ambassador = true) — v2 mit Referral-Details
// Keine neue Tabelle. Bestehende Datenquellen: profiles, works, messages, impact_applications
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// ── Level-Helfer (COM-MIGRATION-015.3: Starter/Bronze/Silber/Gold, 5/10/15/20% -- gleiche Schwellen wie zuvor) ──
function calcLevel(count: number): string {
  if (count >= 201) return 'Gold';
  if (count >= 51)  return 'Silber';
  if (count >= 11)  return 'Bronze';
  return 'Starter';
}
function levelRate(level: string): number {
  if (level === 'Gold')   return 0.20;
  if (level === 'Silber') return 0.15;
  if (level === 'Bronze') return 0.10;
  return 0.05;
}
function levelStyle(level: string): { label: string; color: string } {
  if (level === 'Gold')    return { label: '🥇 Gold (20%)',    color: '#ffd43b' };
  if (level === 'Silber')  return { label: '🥈 Silber (15%)',  color: '#ced4da' };
  if (level === 'Bronze')  return { label: '🥉 Bronze (10%)',  color: '#cd7f32' };
  return                          { label: '🌱 Starter (5%)', color: '#69db7c' };
}

// ── GET: Ambassador-Liste ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const search       = (searchParams.get('search') || '').toLowerCase();
    const type         = searchParams.get('type') || 'list';
    const ambassadorId = searchParams.get('ambassador_id') || '';
    const sb           = getServiceClient();

    // ── Typ: works — Werke eines Ambassadors ──────────────────────────────
    if (type === 'works' && ambassadorId) {
      const { data: works } = await sb
        .from('works')
        .select('id,title,status,created_at,user_id,approval_status,admin_comment,rejection_reason')
        .or(`user_id.eq.${ambassadorId},ambassador_id.eq.${ambassadorId}`)
        .order('created_at', { ascending: false })
        .limit(100);

      // Fallback: works ohne ambassador_id-Spalte → nur user_id
      const { data: works2 } = await sb
        .from('works')
        .select('id,title,status,created_at,user_id,approval_status,admin_comment,rejection_reason')
        .eq('user_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Deduplizieren
      const allWorks = [...(works ?? []), ...(works2 ?? [])];
      const seen = new Set<string>();
      const unique = allWorks.filter(w => { if (seen.has(w.id)) return false; seen.add(w.id); return true; });
      return NextResponse.json({ ok: true, works: unique });
    }

    // ── Typ: projects — Impact-Projekte eines Ambassadors ─────────────────
    if (type === 'projects' && ambassadorId) {
      const { data: projects } = await sb
        .from('impact_applications')
        .select('id,project_name,status,created_at,user_id,admin_comment,rejection_reason,funding_goal')
        .eq('user_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(100);
      return NextResponse.json({ ok: true, projects: projects ?? [] });
    }

    // ── Typ: messages — Nachrichten eines Ambassadors ─────────────────────
    if (type === 'messages' && ambassadorId) {
      const { data: chats } = await sb
        .from('chats')
        .select('id,participant_ids,last_message,last_message_at,state,created_at')
        .contains('participant_ids', [ambassadorId])
        .order('last_message_at', { ascending: false })
        .limit(50);

      const allIds = [...new Set((chats ?? []).flatMap((c: any) => c.participant_ids ?? []))];
      const { data: profiles } = allIds.length
        ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', allIds)
        : { data: [] };
      const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      const enriched = (chats ?? []).map((c: any) => ({
        ...c,
        participants: (c.participant_ids ?? []).map((id: string) => profMap.get(id) ?? { id }),
      }));

      return NextResponse.json({ ok: true, messages: enriched });
    }

    // ── Typ: commissions — Provisionen pro Ambassador (COM-MIGRATION-015.3) ──
    if (type === 'commissions' && ambassadorId) {
      const { data: commissions } = await sb
        .from('stripe_ambassador_commissions')
        .select('id,order_id,amount,currency,rate,status,tier,commission_valid_until,commission_active,base_purchase_amount_cents,company_share_cents,referred_user_id,created_at')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(200);

      const rows = commissions ?? [];
      const referredIds = [...new Set(rows.map((r: any) => r.referred_user_id).filter(Boolean))];
      const { data: referredProfiles } = referredIds.length
        ? await sb.from('profiles').select('id,display_name,username').in('id', referredIds)
        : { data: [] };
      const profMap = new Map((referredProfiles ?? []).map((p: any) => [p.id, p]));

      const now = Date.now();
      const enriched = rows.map((r: any) => ({
        id:                r.id,
        orderId:           r.order_id,
        amountEur:         (r.amount ?? 0) / 100,
        ratePercent:       Number(r.rate) * 100,
        tier:              r.tier,
        status:            r.status,
        commissionValidUntil: r.commission_valid_until,
        isStillActive:     r.commission_active && (!r.commission_valid_until || new Date(r.commission_valid_until).getTime() >= now),
        basePurchaseEur:   (r.base_purchase_amount_cents ?? 0) / 100,
        companyShareEur:   (r.company_share_cents ?? 0) / 100,
        referredUser:      profMap.get(r.referred_user_id) ?? null,
        createdAt:         r.created_at,
      }));

      const totalLifetimeEur = enriched.reduce((s: number, r: any) => s + r.amountEur, 0);
      const activeCount      = enriched.filter((r: any) => r.isStillActive).length;

      return NextResponse.json({
        ok: true,
        commissions: enriched,
        summary: {
          totalLifetimeEur,
          transactionCount: enriched.length,
          activeCount,
          expiredCount: enriched.length - activeCount,
        },
      });
    }

    // ── Typ: stats — Statistiken eines Ambassadors ────────────────────────
    if (type === 'stats' && ambassadorId) {
      const [worksRes, projectsRes, msgsRes] = await Promise.allSettled([
        sb.from('works').select('id', { count: 'exact', head: true }).eq('user_id', ambassadorId),
        sb.from('impact_applications').select('id', { count: 'exact', head: true }).eq('user_id', ambassadorId),
        sb.from('chats').select('id', { count: 'exact', head: true }).contains('participant_ids', [ambassadorId]),
      ]);
      return NextResponse.json({
        ok: true,
        stats: {
          works:    worksRes.status    === 'fulfilled' ? (worksRes.value.count    ?? 0) : 0,
          projects: projectsRes.status === 'fulfilled' ? (projectsRes.value.count ?? 0) : 0,
          messages: msgsRes.status     === 'fulfilled' ? (msgsRes.value.count     ?? 0) : 0,
        },
      });
    }

    // ── Typ: detail — Vollprofil eines Ambassadors (für AmbassadorDrawer) ──
    if ((type === 'detail' || searchParams.get('action') === 'detail') && (ambassadorId || searchParams.get('user_id'))) {
      const uid = ambassadorId || searchParams.get('user_id') || '';
      const [profRes, referredRes, worksRes, projectsRes] = await Promise.allSettled([
        sb.from('profiles').select('*').eq('id', uid).single(),
        sb.from('profiles').select('id,display_name,username,avatar_url,email,phone,role,first_transaction_at,created_at').eq('referred_by', uid),
        sb.from('works').select('id,title,status,approval_status,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
        sb.from('impact_applications').select('id,project_name,status,funding_goal,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
      ]);

      const profile   = profRes.status     === 'fulfilled' ? profRes.value.data     : null;
      const refLinks: any[] = []; // ambassador_ref_links deprecated — reflink aus profiles.username
      const referred  = referredRes.status === 'fulfilled' ? referredRes.value.data ?? [] : [];
      const works     = worksRes.status    === 'fulfilled' ? worksRes.value.data    ?? [] : [];
      const projects  = projectsRes.status === 'fulfilled' ? projectsRes.value.data ?? [] : [];

      const active   = referred.filter((u: any) => u.first_transaction_at).length;
      const sleeping = referred.length - active;

      return NextResponse.json({
        ok: true,
        data: {
          profile,
          refLinks,
          applications: projects,
          referrals: referred.map((u: any) => {
            const validUntil = u.created_at ? new Date(new Date(u.created_at).getTime() + 365*86400000).toISOString() : null;
            return {
              id: u.id,
              display_name: u.display_name ?? u.username ?? '—',
              username: u.username ?? '',
              avatar_url: u.avatar_url ?? null,
              email: u.email ?? null,
              phone: u.phone ?? null,
              role: u.role ?? 'basisuser',
              is_active: !!u.first_transaction_at,
              first_transaction_at: u.first_transaction_at ?? null,
              joined_at: u.created_at,
              // COM-MIGRATION-015.3: 365-Tage-Provisionsfenster ab Registrierung
              commission_valid_until: validUntil,
              commission_window_active: validUntil ? new Date(validUntil).getTime() >= Date.now() : false,
            };
          }),
          stats: { total: referred.length, active, sleeping },
          works,
          projects,
        },
      });
    }

    // ── Standard: Ambassador-Liste ─────────────────────────────────────────
    // WICHTIG: Beide Felder prüfen (role='ambassador' ODER is_ambassador=true)
    const { data: byRole } = await sb
      .from('profiles')
      .select('id,display_name,username,avatar_url,email,role,is_ambassador,profile_modules,created_at,impact_eur')
      .eq('role', 'ambassador');

    const { data: byFlag } = await sb
      .from('profiles')
      .select('id,display_name,username,avatar_url,email,role,is_ambassador,profile_modules,created_at,impact_eur')
      .eq('is_ambassador', true);

    // Deduplizieren
    const seen = new Set<string>();
    const profiles = [...(byRole ?? []), ...(byFlag ?? [])].filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    // Ref-Links: ambassador_ref_links NICHT mehr primäre Quelle
    // Reflink wird autoritativ aus profiles.username berechnet
    const refLinks: any[] = [];

    // Geworbene Nutzer
    const ambassadorIds = profiles.map((p: any) => p.id);
    const referredMap: Record<string, { count: number; active: number; sleeping: number; users: any[] }> = {};

    if (ambassadorIds.length > 0) {
      // referred_by ist TEXT-Spalte — UUID-Strings direkt vergleichbar
      const { data: referred } = await sb
        .from('profiles')
        .select('id,display_name,username,avatar_url,email,phone,role,referred_by,created_at,first_transaction_at')
        .in('referred_by', ambassadorIds.map(String));

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
          phone:            u.phone ?? null,
          role:             u.role ?? null,
          first_transaction_at: u.first_transaction_at ?? null,
          joinedAt:         u.created_at,
          firstTransaction: u.first_transaction_at,
          isActive:         !!u.first_transaction_at,
        });
      }
    }

    const refMap = new Map((refLinks ?? []).map((r: any) => [r.user_id, r]));

    // Live-Umsatz: Single Source of Truth ist stripe_payments.ambassador_id (ARCH-006.1)
    // Ersetzt das nie befüllte Shadow-Feld profile_modules.ambassador.revenue_generated
    const revenueMap: Record<string, number> = {};
    // Live-Impact: gleiche Quelle/Zeilen wie Umsatz, aber impact_pool_share statt amount —
    // ersetzt das tote profiles.impact_eur (nie beschrieben, immer 0). Zeigt den Impact-Anteil
    // (15% der Gebühr, siehe rpc_process_order_fees), der aus den DIESEM Ambassador zugeordneten
    // (referral-getriggerten) Transaktionen entstand — analog/parallel zu revenueMap, nicht die
    // persönliche Käufer/Verkäufer-Impact-Summe (das ist rpc_get_user_impact_totals für User-Mgmt).
    const impactAttributedMap: Record<string, number> = {};
    if (ambassadorIds.length > 0) {
      const { data: ambPayments } = await sb
        .from('stripe_payments')
        .select('ambassador_id, amount, impact_pool_share')
        .in('ambassador_id', ambassadorIds)
        .eq('status', 'succeeded');
      for (const pay of (ambPayments ?? [])) {
        const aid = (pay as { ambassador_id: string; amount: number; impact_pool_share: number | null }).ambassador_id;
        const p = pay as { ambassador_id: string; amount: number; impact_pool_share: number | null };
        revenueMap[aid] = (revenueMap[aid] ?? 0) + p.amount / 100;
        impactAttributedMap[aid] = (impactAttributedMap[aid] ?? 0) + (p.impact_pool_share ?? 0) / 100;
      }
    }

    // COM-MIGRATION-015.3: Gesamtprovision pro Ambassador (Commerce 2.0 orders, neues 15%-Modell)
    const commissionTotalMap: Record<string, number> = {};
    if (ambassadorIds.length > 0) {
      const { data: ambCommissions } = await sb
        .from('stripe_ambassador_commissions')
        .select('ambassador_id, amount')
        .in('ambassador_id', ambassadorIds);
      for (const comm of (ambCommissions ?? [])) {
        const aid = (comm as { ambassador_id: string; amount: number }).ambassador_id;
        commissionTotalMap[aid] = (commissionTotalMap[aid] ?? 0) + (comm as { amount: number }).amount / 100;
      }
    }

    let data = profiles.map((p: any) => {
      const ambMod   = (p.profile_modules as any)?.ambassador ?? {};
      const refData  = referredMap[p.id] ?? { count: 0, active: 0, sleeping: 0, users: [] };
      const refCount = Math.max(refData.count, Number(ambMod.referral_count ?? 0));
      const revenue  = revenueMap[p.id] ?? 0; // live aus stripe_payments, keine Shadow-States
      const level    = calcLevel(refCount);

      return {
        id:            p.id,
        displayName:   p.display_name ?? p.username ?? p.email ?? '—',
        username:      p.username ?? '',
        avatarUrl:     p.avatar_url ?? null,
        email:         p.email ?? null,
        role:          p.role ?? 'ambassador',
        isWirker:      ['ambassador','talent','wirker'].includes(p.role ?? ''),
        impactEur:     impactAttributedMap[p.id] ?? 0,
        createdAt:     p.created_at,
        // Autoritative Quelle: profiles.username → https://be-hui.com/<username>
        // ambassador_ref_links ist Fallback/Cache, aber Link wird immer aus username berechnet
        referralCode:  refMap.get(p.id)?.referral_code ?? ambMod.referral_code ?? null,
        // Single Source of Truth: profiles.username
        referralLink:  p.username ? `https://be-hui.com/${p.username}` : null,
        referralCount: refCount,
        activeCount:   refData.active,
        sleepingCount: refData.sleeping,
        revenueEur:    revenue,
        // COM-MIGRATION-015.3: Gesamtprovision aus stripe_ambassador_commissions (neues 15%-Modell)
        totalCommissionEur: commissionTotalMap[p.id] ?? 0,
        level:         level,
        levelRatePercent: levelRate(level) * 100,
        levelLabel:    levelStyle(level).label,
        levelColor:    levelStyle(level).color,
        linkActive:    ambMod.link_active !== false,
        activatedAt:   ambMod.activated_at ?? null,
        referredUsers: refData.users,
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
      count:     data.length,
      revenue:   data.reduce((s: number, a: any) => s + a.revenueEur, 0),
      referrals: data.reduce((s: number, a: any) => s + a.referralCount, 0),
    };

    return NextResponse.json({ ok: true, data, totals });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── PATCH: Ambassador-Status + Aktionen ────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { user_id, action } = body;
    if (!action) return NextResponse.json({ ok: false, error: 'Fehlender action-Parameter' }, { status: 400 });
    const sb = getServiceClient();

    // ── activate / deactivate ─────────────────────────────────────────────
    if (action === 'activate' && user_id) {
      await sb.from('profiles')
        .update({ is_ambassador: true, role: 'ambassador' })
        .eq('id', user_id);
      const { data: prof } = await sb.from('profiles').select('username').eq('id', user_id).single();
      if (prof?.username) {
        const code = 'AMB-' + prof.username.toUpperCase().slice(0, 5) + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
        await sb.from('ambassador_ref_links').upsert(
          { user_id, username: prof.username, ref_link: `https://be-hui.com/${prof.username}`, referral_code: code },
          { onConflict: 'user_id' }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'deactivate' && user_id) {
      await sb.from('profiles')
        .update({ is_ambassador: false })
        .eq('id', user_id);
      return NextResponse.json({ ok: true });
    }

    // ── send_message: Ambassador sendet Nachricht an Nutzer ───────────────
    if (action === 'send_message') {
      const { ambassador_id, recipient_id, text } = body;
      if (!ambassador_id || !recipient_id || !text)
        return NextResponse.json({ ok: false, error: 'ambassador_id, recipient_id und text erforderlich' }, { status: 400 });

      // Chat suchen oder erstellen
      const { data: existingChats } = await sb
        .from('chats')
        .select('id,participant_ids')
        .contains('participant_ids', [ambassador_id, recipient_id]);

      let chatId: string;
      const exact = (existingChats ?? []).find((c: any) =>
        c.participant_ids?.length === 2 &&
        c.participant_ids.includes(ambassador_id) &&
        c.participant_ids.includes(recipient_id)
      );

      if (exact) {
        chatId = exact.id;
      } else {
        const { data: newChat, error: chatErr } = await sb
          .from('chats')
          .insert({ participant_ids: [ambassador_id, recipient_id], state: 'active', created_at: new Date().toISOString() })
          .select('id').single();
        if (chatErr) throw chatErr;
        chatId = newChat.id;
      }

      const { data: msg, error: msgErr } = await sb
        .from('messages')
        .insert({ chat_id: chatId, text, sender_id: ambassador_id, message_type: 'text', is_read: false })
        .select().single();
      if (msgErr) throw msgErr;

      await sb.from('chats').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', chatId);
      return NextResponse.json({ ok: true, message: msg, chat_id: chatId });
    }

    // ── comment_work: Ambassador kommentiert ein Werk ─────────────────────
    if (action === 'comment_work') {
      const { ambassador_id, work_id, text } = body;
      if (!ambassador_id || !work_id || !text)
        return NextResponse.json({ ok: false, error: 'ambassador_id, work_id und text erforderlich' }, { status: 400 });

      const { data: note, error: noteErr } = await sb
        .from('notes')
        .insert({ entity_type: 'work', entity_id: work_id, author_id: ambassador_id, text, note_type: 'ambassador_comment', created_at: new Date().toISOString() })
        .select().single();

      // Fallback: notification_events wenn notes-Tabelle anders strukturiert
      if (noteErr) {
        await sb.from('notification_events').insert({
          type:       'ambassador_work_comment',
          table_name: 'works',
          record_id:  work_id,
          user_id:    ambassador_id,
          reason:     text,
          created_at: new Date().toISOString(),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // ── comment_project: Ambassador kommentiert ein Projekt ───────────────
    if (action === 'comment_project') {
      const { ambassador_id, project_id, text } = body;
      if (!ambassador_id || !project_id || !text)
        return NextResponse.json({ ok: false, error: 'ambassador_id, project_id und text erforderlich' }, { status: 400 });

      await sb.from('notification_events').insert({
        type:       'ambassador_project_comment',
        table_name: 'impact_applications',
        record_id:  project_id,
        user_id:    ambassador_id,
        reason:     text,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    // ── resonance: Ambassador gibt Resonanz auf ein Werk ─────────────────
    if (action === 'resonance') {
      const { ambassador_id, work_id, value } = body;
      if (!ambassador_id || !work_id)
        return NextResponse.json({ ok: false, error: 'ambassador_id und work_id erforderlich' }, { status: 400 });

      const { error: resErr } = await sb
        .from('resonance')
        .upsert({ work_id, user_id: ambassador_id, value: value ?? 1, created_at: new Date().toISOString() },
                { onConflict: 'work_id,user_id' });

      if (resErr) {
        // Fallback: notification_events
        await sb.from('notification_events').insert({
          type: 'ambassador_resonance', table_name: 'works', record_id: work_id,
          user_id: ambassador_id, reason: String(value ?? 1), created_at: new Date().toISOString(),
        });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
