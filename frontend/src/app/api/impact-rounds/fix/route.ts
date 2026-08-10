// One-time fix: Close stale impact_rounds + ensure current month round exists
// Created: 2026-08-10 — fixes double-active-rounds bug
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Close ALL active rounds
    const { data: closedRounds, error: closeErr } = await sb
      .from('impact_rounds')
      .update({ status: 'closed', updated_at: now.toISOString() })
      .eq('status', 'active')
      .select('id, month, pool_eur');

    if (closeErr) {
      return NextResponse.json({ ok: false, error: `Close failed: ${closeErr.message}` }, { status: 500 });
    }

    // 2. Create current month round (use upsert-like logic)
    const { data: existingRound } = await sb
      .from('impact_rounds')
      .select('id')
      .eq('month', currentMonth)
      .maybeSingle();

    let roundInfo;
    if (existingRound) {
      const { data: updated, error: updErr } = await sb
        .from('impact_rounds')
        .update({ status: 'active', updated_at: now.toISOString() })
        .eq('id', existingRound.id)
        .select('id, month, status')
        .single();
      if (updErr) return NextResponse.json({ ok: false, error: `Reactivate failed: ${updErr.message}` }, { status: 500 });
      roundInfo = updated;
    } else {
      const { data: newRound, error: insErr } = await sb
        .from('impact_rounds')
        .insert({
          month: currentMonth,
          status: 'active',
          pool_eur: 0,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('id, month, status')
        .single();
      if (insErr) return NextResponse.json({ ok: false, error: `Insert failed: ${insErr.message}` }, { status: 500 });
      roundInfo = newRound;
    }

    return NextResponse.json({
      ok: true,
      closed: closedRounds || [],
      active: roundInfo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
