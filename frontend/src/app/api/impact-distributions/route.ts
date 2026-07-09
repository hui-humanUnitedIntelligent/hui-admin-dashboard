// frontend/src/app/api/impact-distributions/route.ts
// IMPACT-VOTING-ENGINE-001 Phase 3 (2026-07-09)
// Gibt die Verteilungshistorie aus impact_distributions zurück
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    const sb = getServiceClient();
    const { data, error } = await sb
      .from('impact_distributions')
      .select('*')
      .order('distributed_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
