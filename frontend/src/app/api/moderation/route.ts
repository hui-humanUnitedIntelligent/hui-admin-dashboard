// frontend/src/app/api/moderation/route.ts
// CONTENT-MODERATION-001 (2026-08-20): Admin-API für Inhaltsprüfung
// UPDATE (2026-08-21): Lädt user_email auch bei Hard-Block (kein beitrag),
//                       neue PATCH-Actions: warn, block, delete
import { NextResponse, NextRequest } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ── GET: Liste aller Moderations-Einträge ────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  const sb = getServiceClient();

  let q = sb.from('content_moderation')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'flagged')        q = q.eq('is_flagged', true);
  else if (status === 'blurred')   q = q.eq('is_blurred', true);
  else if (status === 'false_positive') q = q.eq('is_false_positive', true);

  const { data: modData, error: modErr } = await q;
  if (modErr) {
    return NextResponse.json({ error: modErr.message }, { status: 500 });
  }

  if (!modData || modData.length === 0) {
    return NextResponse.json({ data: [], count: 0 });
  }

  // 2. Verknüpfte beitraege-Daten laden (kann leer sein bei Hard-Block)
  const contentIds = modData.map((m: any) => m.content_id).filter(Boolean);
  let beitraegeMap: Record<string, any> = {};

  if (contentIds.length > 0) {
    const { data: beitraege, error: beitErr } = await sb.from('beitraege')
      .select('id, user_id, type, caption, content, src, moment_source, created_at, moderation_blurred, moderation_flag, moderation_categories')
      .in('id', contentIds);

    if (!beitErr && beitraege) {
      beitraegeMap = beitraege.reduce((acc: Record<string, any>, b: any) => {
        acc[b.id] = b;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  // 3. User-Namen + Email laden — aus content_moderation.user_id ODER beitrag.user_id
  const userIds = new Set<string>();
  for (const m of modData) {
    if (m.user_id) userIds.add(m.user_id);
  }
  for (const b of Object.values(beitraegeMap)) {
    if ((b as any).user_id) userIds.add((b as any).user_id);
  }

  let userMap: Record<string, any> = {};
  if (userIds.size > 0) {
    const { data: users } = await sb.from('profiles')
      .select('id, full_name, display_name, username, avatar_url, email, blocked, blocked_at, blocked_by, warning_count, last_warned_at')
      .in('id', Array.from(userIds));
    if (users) {
      userMap = users.reduce((acc: Record<string, any>, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  // Merge
  const merged = modData.map((m: any) => {
    const beitrag = beitraegeMap[m.content_id] || {};
    const userId = m.user_id || beitrag.user_id || null;
    const user = userMap[userId] || {};
    return {
      ...m,
      beitrag_type: beitrag.type || null,
      beitrag_caption: beitrag.caption || null,
      beitrag_content: beitrag.content || null,
      beitrag_src: beitrag.src || null,
      beitrag_moment_source: beitrag.moment_source || null,
      beitrag_created_at: beitrag.created_at || null,
      beitrag_moderation_blurred: beitrag.moderation_blurred || false,
      beitrag_moderation_flag: beitrag.moderation_flag || false,
      beitrag_moderation_categories: beitrag.moderation_categories || [],
      user_name: user.full_name || user.display_name || user.username || 'Unbekannt',
      user_username: user.username || null,
      user_avatar: user.avatar_url || null,
      user_email: user.email || null,
      user_id: userId,
      user_blocked: user.blocked || false,
      user_blocked_at: user.blocked_at || null,
      user_blocked_by: user.blocked_by || null,
      user_warning_count: user.warning_count || 0,
      user_last_warned_at: user.last_warned_at || null,
    };
  });

  // Filter by search
  let filtered = merged;
  if (search) {
    const s = search.toLowerCase();
    filtered = merged.filter((m: any) =>
      (m.beitrag_caption || '').toLowerCase().includes(s) ||
      (m.beitrag_content || '').toLowerCase().includes(s) ||
      (m.user_name || '').toLowerCase().includes(s) ||
      (m.user_email || '').toLowerCase().includes(s)
    );
  }

  return NextResponse.json({ data: filtered, count: filtered.length });
}

// ── PATCH: Status aktualisieren ─────────────────────────────────────────
// Actions: approve | false_positive | blur | unblur | warn | block | delete
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();
  const body = await req.json();
  const { id, action, reason } = body;

  if (!id || !action) {
    return NextResponse.json({ error: 'id und action erforderlich' }, { status: 400 });
  }

  // ── Moderation-Status Actions (bestehend) ──
  if (action === 'approve' || action === 'false_positive' || action === 'blur' || action === 'unblur') {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'approve':
        updates.is_flagged = false;
        updates.is_blurred = false;
        updates.is_false_positive = false;
        updates.admin_status = 'cleared';
        break;
      case 'false_positive':
        updates.is_flagged = false;
        updates.is_blurred = false;
        updates.is_false_positive = true;
        updates.admin_status = 'cleared';
        break;
      case 'blur':
        updates.is_blurred = true;
        updates.admin_status = 'blurred';
        break;
      case 'unblur':
        updates.is_blurred = false;
        updates.is_flagged = false;
        updates.admin_status = 'cleared';
        break;
    }

    const { data: modRow, error: modErr } = await sb.from('content_moderation')
      .update(updates)
      .eq('id', id)
      .select('content_id, user_id')
      .single();

    if (modErr) {
      return NextResponse.json({ error: modErr.message }, { status: 500 });
    }

    if (modRow?.content_id) {
      const beitragUpdates: Record<string, any> = {};
      if ('is_blurred' in updates) beitragUpdates.moderation_blurred = updates.is_blurred;
      if ('is_flagged' in updates) beitragUpdates.moderation_flag = updates.is_flagged;

      if (Object.keys(beitragUpdates).length > 0) {
        await sb.from('beitraege')
          .update(beitragUpdates)
          .eq('id', modRow.content_id);
      }
    }

    return NextResponse.json({ success: true, id, action });
  }

  // ── User-Actions: warn / block / delete (neu, 2026-08-21) ──
  if (action === 'warn' || action === 'block' || action === 'delete') {
    const { data: modEntry, error: modErr } = await sb.from('content_moderation')
      .select('user_id, content_id')
      .eq('id', id)
      .single();

    if (modErr || !modEntry?.user_id) {
      return NextResponse.json({ error: 'Keine user_id für diesen Eintrag' }, { status: 400 });
    }

    const userId = modEntry.user_id;
    const now = new Date().toISOString();
    const effectiveReason = (reason && reason.trim()) ? reason.trim() : '';

    const modUpdate: Record<string, any> = {
      updated_at: now,
      reviewed_at: now,
      admin_notes: effectiveReason || null,
    };

    if (action === 'warn') {
      modUpdate.admin_status = 'warned';
      const { data: profile } = await sb.from('profiles')
        .select('warning_count')
        .eq('id', userId)
        .single();

      const newCount = (profile?.warning_count || 0) + 1;
      await sb.from('profiles')
        .update({
          warning_count: newCount,
          last_warned_at: now,
          last_warning_reason: effectiveReason || 'Verwarnung wegen Richtlinienverletzung',
        })
        .eq('id', userId);

      await sb.from('notifications').insert({
        user_id: userId,
        type: 'moderation_warning',
        title: 'Verwarnung',
        body: effectiveReason || 'Dein Inhalt verstößt gegen unsere Richtlinien. Bitte halte dich an unsere Community-Regeln.',
        data: { moderation_id: id, warning_count: newCount },
      });

    } else if (action === 'block' || action === 'delete') {
      modUpdate.admin_status = action === 'block' ? 'user_blocked' : 'user_deleted';
      const message = action === 'delete'
        ? (effectiveReason || 'Dein HUI-Konto wurde deaktiviert.')
        : (effectiveReason || 'Dein Konto wurde von einem Admin blockiert. Bei Fragen: support@be-hui.com');

      await sb.from('profiles')
        .update({
          blocked: true,
          blocked_at: now,
          blocked_by: message,
        })
        .eq('id', userId);

      const supabaseUrl = process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: '87600h' }),
          });
        } catch (e) { console.warn('[moderation PATCH] auth ban failed:', e); }
      }
    }

    await sb.from('content_moderation')
      .update(modUpdate)
      .eq('id', id);

    return NextResponse.json({ success: true, id, action, user_id: userId });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
