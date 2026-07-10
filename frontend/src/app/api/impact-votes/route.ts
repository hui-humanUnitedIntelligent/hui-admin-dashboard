// IMPACT-VOTING-ENGINE-001 — Impact Votes API
// Liefert die Stimmen-Verteilung für den aktuellen (oder angegebenen) Monat.
// Tabelle: impact_votes (voter_id, project_id, pool_month)
// Verknüpft project_id mit impact_applications (id, project_name) für Anzeige.
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const sb = getServiceClient();

    // Pool-Monat bestimmen: explizit übergeben, sonst aktueller Monat (YYYY-MM)
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = searchParams.get('month') ?? defaultMonth;

    // ── Vote-Verteilung für den Monat ───────────────────────────────────────
    // impact_votes nach project_id gruppieren und zählen.
    const { data: voteRows, error: voteErr } = await sb
      .from('impact_votes')
      .select('project_id, voter_id')
      .eq('pool_month', month);

    if (voteErr) return NextResponse.json({ ok: false, error: voteErr.message }, { status: 500 });

    // Vote-Counts pro Projekt aggregieren
    const voteCountByProject: Record<string, number> = {};
    const uniqueVoters = new Set<string>();
    for (const v of voteRows ?? []) {
      const pid = v.project_id as string;
      voteCountByProject[pid] = (voteCountByProject[pid] ?? 0) + 1;
      if (v.voter_id) uniqueVoters.add(v.voter_id as string);
    }

    // Projektnamen nachladen (impact_applications)
    const projectIds = Object.keys(voteCountByProject);
    const projectNameMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: apps } = await sb
        .from('impact_applications')
        .select('id, project_name')
        .in('id', projectIds);
      for (const a of apps ?? []) {
        projectNameMap[a.id as string] = (a.project_name as string) ?? 'Unbenanntes Projekt';
      }
    }

    // Verteilung als sortiertes Array (meiste Stimmen zuerst)
    const distribution = projectIds
      .map(pid => ({
        project_id:   pid,
        project_name: projectNameMap[pid] ?? 'Unbenanntes Projekt',
        votes:        voteCountByProject[pid],
      }))
      .sort((a, b) => b.votes - a.votes);

    const totalVotes = (voteRows ?? []).length;

    return NextResponse.json({
      ok: true,
      month,
      total_votes:    totalVotes,
      unique_voters:  uniqueVoters.size,
      distribution,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
