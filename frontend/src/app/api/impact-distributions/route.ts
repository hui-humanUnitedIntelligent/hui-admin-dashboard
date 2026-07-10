// frontend/src/app/api/impact-distributions/route.ts
// IMPACT-VOTING-ENGINE-001 Phase 3 — erweitert mit Monatsfilter & Statistiken
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 1000);
    const month  = searchParams.get('month') ?? null;   // e.g. "2026-07"
    const mode   = searchParams.get('mode') ?? 'list';  // "list" | "months" | "stats" | "ranking"

    const sb = getServiceClient();

    // ── Modus: Statistiken ──────────────────────────────────────────────────
    if (mode === 'stats') {
      const { data: all, error } = await sb
        .from('impact_distributions')
        .select('amount_eur, pool_month, project_id, rank_at_time');
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      const total = (all ?? []).reduce((s, r) => s + Number(r.amount_eur ?? 0), 0);
      const months = [...new Set((all ?? []).map(r => r.pool_month))].sort().reverse();
      const byProject: Record<string, number> = {};
      for (const r of all ?? []) {
        byProject[r.project_id] = (byProject[r.project_id] ?? 0) + Number(r.amount_eur ?? 0);
      }
      return NextResponse.json({ total_eur: total, months, by_project: byProject, count: (all ?? []).length });
    }

    // ── Modus: Monatsübersicht (gruppiert) ──────────────────────────────────
    if (mode === 'months') {
      const { data: all, error } = await sb
        .from('impact_distributions')
        .select('pool_month, amount_eur, rank_at_time, project_id')
        .order('pool_month', { ascending: false });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      // Gruppiere nach Monat
      const grouped: Record<string, { month: string; total: number; entries: number; top1?: string }> = {};
      for (const r of all ?? []) {
        const m = r.pool_month ?? 'unknown';
        if (!grouped[m]) grouped[m] = { month: m, total: 0, entries: 0 };
        grouped[m].total += Number(r.amount_eur ?? 0);
        grouped[m].entries += 1;
      }
      return NextResponse.json(Object.values(grouped).sort((a, b) => b.month.localeCompare(a.month)));
    }


    // ── Modus: Ranking (via RPC) ─────────────────────────────────────────────
    if (mode === 'ranking') {
      const { data, error } = await sb.rpc('rpc_get_impact_ranking');
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    // ── Modus: Liste (default) ──────────────────────────────────────────────
    let query = sb
      .from('impact_distributions')
      .select('*')
      .order('distributed_at', { ascending: false })
      .limit(limit);

    if (month) query = query.eq('pool_month', month);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
