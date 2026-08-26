// frontend/src/app/api/impact-ranking/route.ts
// IMPACT-VOTING-ENGINE-001 Phase 3 (2026-07-09)
// Gibt das aktuelle Impact-Ranking zurück via rpc_get_impact_ranking()
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_impact_ranking');
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
