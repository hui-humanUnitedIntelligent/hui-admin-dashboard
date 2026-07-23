// frontend/src/app/api/momente/route.ts
// MOMENTE-REPORTS-001 v2: beitraege hat KEIN status-Feld
// Felder: id, user_id, src, type, caption, visibility_scope, moment_source, created_at
import { NextResponse, NextRequest } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BEITRAG_SELECT = 'id, user_id, type, caption, src, visibility_scope, moment_source, created_at';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const tab    = searchParams.get('status') || 'all';  // 'all' | 'reported' | 'deleted' | 'public'
  const search = searchParams.get('search') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '500'), 500);

  const sb = getServiceClient();

  // ── Basis-Query: ALLE Momente aus beitraege (kein status-Feld!) ────────
  // Gemeldete/Entfernte werden über momente_reports bzw. einen separaten
  // Soft-Delete-Mechanismus verwaltet; Standard = alle anzeigen
  let q = sb.from('beitraege')
    .select(BEITRAG_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  // Kein status-Filter auf beitraege — Tabelle hat dieses Feld nicht.
  // 'reported' / 'deleted' kommen aus momente_reports / momente_removals.
  // Für Tab-Filterung: nach Report-Count filtern (post-fetch).

  if (search) q = (q as any).ilike('caption', `%${search}%`);

  const { data, count, error } = await q;
  if (error) {
    console.error('[momente GET] beitraege query error:', error);
    return NextResponse.json({ entries: [], total: 0, counts: { all:0, public:0, reported:0, deleted:0 } }, { status: 500 });
  }

  const rows = data ?? [];

  // ── Profil-Daten via Batch-Lookup (kein FK-Join nötig) ───────────────
  const userIds = [...new Set(rows.map((e: any) => e.user_id).filter(Boolean))];
  let profileMap: Record<string, { full_name: string|null; username: string|null; avatar_url: string|null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds);
    (profiles ?? []).forEach((p: any) => {
      profileMap[p.id] = { full_name: p.full_name, username: p.username, avatar_url: p.avatar_url };
    });
  }

  // ── Report-Counts via momente_reports ────────────────────────────────
  const ids = rows.map((e: any) => e.id);
  let reportMap: Record<string, number> = {};
  let reportedIds = new Set<string>();

  if (ids.length > 0) {
    // Versuche momente_reports — falls Tabelle noch nicht existiert, graceful fallback
    const { data: reports, error: repErr } = await sb
      .from('momente_reports')
      .select('moment_id')
      .in('moment_id', ids);

    if (!repErr) {
      (reports ?? []).forEach((r: any) => {
        reportMap[r.moment_id] = (reportMap[r.moment_id] ?? 0) + 1;
      });
      // Als "gemeldet" gilt: ≥1 Meldung
      Object.entries(reportMap).forEach(([mid, cnt]) => {
        if (cnt >= 1) reportedIds.add(mid);
      });
    }
  }

  // ── Entfernte: momente_removals (optional, falls Tabelle existiert) ──
  let removedIds = new Set<string>();
  if (ids.length > 0) {
    const { data: removals } = await sb
      .from('momente_removals')
      .select('moment_id')
      .in('moment_id', ids);
    (removals ?? []).forEach((r: any) => removedIds.add(r.moment_id));
  }

  // ── Alle Entries aufbauen ─────────────────────────────────────────────
  const allEntries = rows.map((e: any) => ({
    id:                 e.id,
    initiator_id:       e.user_id,
    initiator_name:     profileMap[e.user_id]?.full_name  ?? null,
    initiator_username: profileMap[e.user_id]?.username   ?? null,
    initiator_avatar:   profileMap[e.user_id]?.avatar_url ?? null,
    caption:            e.caption           ?? null,
    moment_type:        e.type              ?? null,
    moment_source:      e.moment_source     ?? null,
    src:                e.src               ?? null,
    visibility_scope:   e.visibility_scope  ?? 'public',
    report_count:       reportMap[e.id]     ?? 0,
    is_reported:        reportedIds.has(e.id),
    is_removed:         removedIds.has(e.id),
    // Virtueller Status für Tabs
    derived_status:     removedIds.has(e.id) ? 'deleted'
                      : reportedIds.has(e.id) ? 'reported'
                      : 'public',
    created_at:         e.created_at,
  }));

  // ── Tab-Filterung (post-fetch) ────────────────────────────────────────
  let filtered = allEntries;
  if      (tab === 'reported') filtered = allEntries.filter(e => e.is_reported && !e.is_removed);
  else if (tab === 'deleted')  filtered = allEntries.filter(e => e.is_removed);
  else if (tab === 'public')   filtered = allEntries.filter(e => !e.is_reported && !e.is_removed);
  // tab === 'all' → alle

  // ── KPI-Counts ────────────────────────────────────────────────────────
  const counts = {
    all:      allEntries.length,
    public:   allEntries.filter(e => !e.is_reported && !e.is_removed).length,
    reported: allEntries.filter(e => e.is_reported && !e.is_removed).length,
    deleted:  allEntries.filter(e => e.is_removed).length,
  };

  return NextResponse.json({ entries: filtered, total: filtered.length, counts });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id, action } = await req.json();
    if (!id || !action) return NextResponse.json({ ok: false, error: 'id + action erforderlich' }, { status: 400 });

    const sb = getServiceClient();

    if (action === 'delete') {
      // Soft-Remove via momente_removals
      const { error } = await sb.from('momente_removals').upsert({ moment_id: id, removed_at: new Date().toISOString() }, { onConflict: 'moment_id' });
      if (error) {
        // Fallback: Tabelle existiert noch nicht → direktes Löschen
        const { error: delErr } = await sb.from('beitraege').delete().eq('id', id);
        if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'restore') {
      await sb.from('momente_removals').delete().eq('moment_id', id);
      await sb.from('momente_reports').delete().eq('moment_id', id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
