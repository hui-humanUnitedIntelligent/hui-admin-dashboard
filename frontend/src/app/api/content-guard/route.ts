// frontend/src/app/api/content-guard/route.ts
// CONTENT-GUARD-001 (2026-09-15, Michael-Spec Teil 2): Stats + Logs fuer
// den SADB-Tab "Chat Content Guard". Quelle: content_guard_logs-Tabelle
// (Migration 142) — 1 Row pro Keyword-Treffer einer Awareness-Erstellung
// (Dedup-Faelle werden NICHT geloggt, keine Spam-Rows).
// Heutige/Woche-Counts + Top-Keywords + letzte Events (User aufgeloest).
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const { data: logs, error } = await sb
      .from('content_guard_logs')
      .select('id, created_at, chat_id, user_id, category, keyword')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const todayCount = (logs ?? []).filter(l => l.created_at >= todayIso).length;
    const weekCount = logs?.length ?? 0;

    // Top-Keywords (Woche)
    const kwCount = new Map<string, number>();
    const catCount = new Map<string, number>();
    for (const l of logs ?? []) {
      kwCount.set(l.keyword, (kwCount.get(l.keyword) ?? 0) + 1);
      catCount.set(l.category, (catCount.get(l.category) ?? 0) + 1);
    }
    const topKeywords = [...kwCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }));
    const topCategories = [...catCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    // Profile der aktiven User der letzten Events aufloesen
    const recent = (logs ?? []).slice(0, 100);
    const userIds = [...new Set(recent.map(l => l.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const recentEnriched = recent.map(l => ({
      ...l,
      user: profMap.get(l.user_id) ?? null,
    }));

    return NextResponse.json({
      ok: true,
      todayCount,
      weekCount,
      topKeywords,
      topCategories,
      recent: recentEnriched,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
