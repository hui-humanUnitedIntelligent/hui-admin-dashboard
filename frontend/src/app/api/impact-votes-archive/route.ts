// API: Impact Votes Archive — Vormonat-Zusammenfassung für SADB
import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await guardSuperAdmin(request);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 'YYYY-MM' oder null = alle

    // Vormonat-Stimmen aus Archiv laden
    const { data, error } = await sb
      .rpc('rpc_get_votes_archive_summary', { p_month: month || null });

    if (error) {
      console.error('[votes-archive] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Monate gruppieren für Dropdown
    const months = [...new Set((data || []).map((r: any) => r.pool_month))].sort().reverse();

    return NextResponse.json({ data: data || [], months });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
