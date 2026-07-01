// frontend/src/app/api/ambassador/route.ts
// Ambassador-API — ARCH-006.1
// Ambassadors = profiles WHERE (role = 'ambassador' OR is_ambassador = true)
// Keine neue Tabelle. Bestehende Datenquellen: profiles, works, messages, impact_applications
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// ── Level-Helfer ────────────────────────────────────────────────────────────
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
      const [profRes, refRes, referredRes, worksRes, projectsRes] = await Promise.allSettled([
        sb.from('profiles').select('*').eq('id', uid).single(),
        sb.from('ambassador_ref_links').select('*').eq('user_id', uid),
        sb.from('profiles').select('id,display_name,username,avatar_url,email,first_transaction_at,created_at').eq('referred_by', uid),
        sb.from('works').select('id,title,status,approval_status,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
        sb.from('impact_applications').select('id,project_name,status,funding_goal,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
      ]);

      const profile   = profRes.status    === 'fulfilled' ? profRes.value.data    : null;
      const refLinks  = refRes.status     === 'fulfilled' ? refRes.value.data     ?? [] : [];
      const referred  = referredRes.status === 'fulfilled' ? referredRes.value.data ?? [] : [];
      const works     = worksRes.status   === 'fulfilled' ? worksRes.value.data   ?? [] : [];
      const projects  = projectsRes.status === 'fulfilled' ? projectsRes.value.data ?? [] : [];

      const active   = referred.filter((u: any) => u.first_transaction_at).length;
      const sleeping = referred.length - active;

      return NextResponse.json({
        ok: true,
        data: {
          profile,
          refLinks,
          applications: projects,
          referrals: referred.map((u: any) => ({
            id: u.id,
            display_name: u.display_name ?? u.username ?? '—',
            username: u.username ?? '',
            avatar_url: u.avatar_url ?? null,
            is_active: !!u.first_transaction_at,
            joined_at: u.created_at,
          })),
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

    // Ref-Links
    const { data: refLinks } = await sb
      .from('ambassador_ref_links')
      .select('user_id,ref_link,referral_code,created_at');

    // Geworbene Nutzer
    const ambassadorIds = profiles.map((p: any) => p.id);
    const referredMap: Record<string, { count: number; active: number; sleeping: number; users: any[] }> = {};

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

    const refMap = new Map((refLinks ?? []).map((r: any) => [r.user_id, r]));

    let data = profiles.map((p: any) => {
      const ambMod   = (p.profile_modules as any)?.ambassador ?? {};
      const refData  = referredMap[p.id] ?? { count: 0, active: 0, sleeping: 0, users: [] };
      const refCount = Math.max(refData.count, Number(ambMod.referral_count ?? 0));
      const revenue  = Number(ambMod.revenue_generated ?? ambMod.revenue_total ?? 0);
      const level    = calcLevel(refCount);

      return {
        id:            p.id,
        displayName:   p.display_name ?? p.username ?? p.email ?? '—',
        username:      p.username ?? '',
        avatarUrl:     p.avatar_url ?? null,
        email:         p.email ?? null,
        role:          p.role ?? 'ambassador',
        isWirker:      ['ambassador','talent','wirker'].includes(p.role ?? ''),
        impactEur:     p.impact_eur ?? 0,
        createdAt:     p.created_at,
        referralCode:  refMap.get(p.id)?.referral_code ?? ambMod.referral_code ?? null,
        referralLink:  refMap.get(p.id)?.ref_link ?? ambMod.ref_link ?? null,
        referralCount: refCount,
        activeCount:   refData.active,
        sleepingCount: refData.sleeping,
        revenueEur:    revenue,
        level:         level,
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
