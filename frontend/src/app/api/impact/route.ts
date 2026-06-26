// frontend/src/app/api/impact/route.ts
// Impact Pool: Projekte, Pool-Finanzen, Votes, Bewerbungen
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get('type')   || 'all'; // 'all'|'projects'|'applications'|'pool'|'votes'
    const status = searchParams.get('status') || 'all';
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sb     = getServiceClient();

    // ── Pool-Finanzdaten ──────────────────────────────────────────────────
    if (type === 'pool') {
      const { data: pool } = await sb
        .from('impact_pool')
        .select('*')
        .order('month', { ascending: false });
      return NextResponse.json({ ok: true, pool: pool ?? [] });
    }

    // ── Votes ─────────────────────────────────────────────────────────────
    if (type === 'votes') {
      const { data: votes, count } = await sb
        .from('impact_votes')
        .select('id,voter_id,project_id,pool_month,weight,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);
      return NextResponse.json({ ok: true, votes: votes ?? [], total: count ?? 0 });
    }

    // ── Bewerbungen ───────────────────────────────────────────────────────
    if (type === 'applications') {
      let q = sb.from('impact_applications')
        .select('id,user_id,project_name,short_desc,problem,vision,funding_goal,contact_name,contact_email,status,submitted_at,created_at,reviewed_at,admin_comment,review_note,rejection_reason,cover_url,location,website', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, count } = await q.range(offset, offset + limit - 1);

      // Profile nachladen
      const uids = [...new Set((data ?? []).map((a: { user_id: string }) => a.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', uids)
        : { data: [] };
      const pm = new Map((profs ?? []).map(p => [p.id, p]));
      const enriched = (data ?? []).map((a: Record<string, unknown>) => ({ ...a, applicant: pm.get(a.user_id as string) ?? null }));

      return NextResponse.json({ applications: enriched, total: count ?? 0 });
    }

    // ── Projekte (default) ────────────────────────────────────────────────
    let q = sb.from('impact_projects')
      .select('id,name,category,description,icon,color,status,votes,month,awarded_eur,website,contact_name,contact_email,tags,created_at,updated_at,distributed_at,impact_report', { count: 'exact' })
      .order('votes', { ascending: false });

    if (status !== 'all') q = q.eq('status', status);
    const { data: projects, count, error } = await q.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // ── Live Votes aus impact_votes (ground truth) ────────────────────────
    const { data: voteRows } = await sb
      .from('impact_votes')
      .select('project_id,pool_month,weight');

    const voteMap = new Map<string, number>();
    for (const v of (voteRows ?? [])) {
      voteMap.set(v.project_id, (voteMap.get(v.project_id) ?? 0) + (v.weight ?? 1));
    }

    // ── Pool-Finanzdaten ──────────────────────────────────────────────────
    const { data: poolRows } = await sb.from('impact_pool').select('*').order('month', { ascending: false });
    const latestPool  = (poolRows ?? [])[0] ?? null;
    const totalPoolEur     = (poolRows ?? []).reduce((s, p) => s + (p.total_eur ?? 0), 0);
    const totalDistributed = (poolRows ?? []).reduce((s, p) => s + (p.distributed_eur ?? 0), 0);
    // awarded aus Projekten (won)
    const totalAwarded  = (projects ?? []).reduce((s: number, p: { awarded_eur?: number }) => s + (p.awarded_eur ?? 0), 0);
    const totalVotes    = (projects ?? []).reduce((s: number, p: { votes?: number })       => s + (p.votes ?? 0), 0);

    // Projekte mit Live-Votes anreichern
    const enrichedProjects = (projects ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      live_votes: voteMap.get(p.id as string) ?? (p.votes as number) ?? 0,
    }));

    // Status-Counts
    const statusCounts: Record<string, number> = {};
    for (const p of (projects ?? [])) {
      const s = (p as { status: string }).status || 'unknown';
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    return NextResponse.json({
      projects:     enrichedProjects,
      total:        count ?? 0,
      statusCounts,
      pool: {
        latest:          latestPool,
        totalEur:        totalPoolEur,
        distributedEur:  totalDistributed,
        awardedEur:      totalAwarded,
        openEur:         Math.max(0, totalPoolEur - totalDistributed),
        totalVotes,
        // Finanzberechnung (15%-Regel basiert auf tatsächlichem Pool)
        bruttoPool:      totalPoolEur,
        nettoImpact:     totalPoolEur * 0.85,
        firmenanteil:    totalPoolEur * 0.15,
      },
      pools: poolRows ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[impact GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH: Projekt-Status, Beträge, Bewerbung-Review
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { entity, id, ...updates } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });

    const sb = getServiceClient();
    const table = entity === 'application' ? 'impact_applications' : 'impact_projects';

    const { error } = await sb.from(table).update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
