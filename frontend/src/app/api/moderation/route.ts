// frontend/src/app/api/moderation/route.ts
// CONTENT-MODERATION-001 (2026-08-20): Admin-API für Inhaltsprüfung
// Liest content_moderation-Tabelle + verknüpfte beitraege-Daten
import { NextResponse, NextRequest } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ── GET: Liste aller Moderations-Einträge ────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all'; // all | flagged | blurred | approved | false_positive
  const search = searchParams.get('search') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  const sb = getServiceClient();

  // 1. content_moderation-Einträge laden
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

  // 2. Verknüpfte beitraege-Daten laden
  const contentIds = modData.map(m => m.content_id).filter(Boolean);
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

    // 3. User-Namen laden
    const userIds = Object.values(beitraegeMap).map((b: any) => b.user_id).filter(Boolean);
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await sb.from('profiles')
        .select('id, full_name, display_name, username, avatar_url')
        .in('id', userIds);
      if (users) {
        userMap = users.reduce((acc: Record<string, any>, u: any) => {
          acc[u.id] = u;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Merge
    const merged = modData.map(m => {
      const beitrag = beitraegeMap[m.content_id] || {};
      const user = userMap[beitrag.user_id] || {};
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
      };
    });

    // Filter by search
    let filtered = merged;
    if (search) {
      const s = search.toLowerCase();
      filtered = merged.filter(m =>
        (m.beitrag_caption || '').toLowerCase().includes(s) ||
        (m.beitrag_content || '').toLowerCase().includes(s) ||
        (m.user_name || '').toLowerCase().includes(s)
      );
    }

    return NextResponse.json({ data: filtered, count: filtered.length });
  }

  return NextResponse.json({ data: modData, count: modData.length });
}

// ── PATCH: Status aktualisieren (freigeben / false_positive / blurred toggle) ──
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();
  const body = await req.json();
  const { id, action } = body; // id = content_moderation.id, action = 'approve' | 'false_positive' | 'blur' | 'unblur'

  if (!id || !action) {
    return NextResponse.json({ error: 'id und action erforderlich' }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'approve':
      updates.is_flagged = false;
      updates.is_blurred = false;
      updates.is_false_positive = false;
      break;
    case 'false_positive':
      updates.is_flagged = false;
      updates.is_blurred = false;
      updates.is_false_positive = true;
      break;
    case 'blur':
      updates.is_blurred = true;
      break;
    case 'unblur':
      updates.is_blurred = false;
      updates.is_flagged = false;
      break;
    default:
      return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  }

  // 1. content_moderation aktualisieren
  const { data: modRow, error: modErr } = await sb.from('content_moderation')
    .update(updates)
    .eq('id', id)
    .select('content_id')
    .single();

  if (modErr) {
    return NextResponse.json({ error: modErr.message }, { status: 500 });
  }

  // 2. beitraege.moderation_blurred/flag synchronisieren
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
