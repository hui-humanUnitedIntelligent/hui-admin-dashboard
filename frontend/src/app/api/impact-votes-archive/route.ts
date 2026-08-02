// API: Impact Votes Archive — Vormonat-Zusammenfassung für SADB
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 'YYYY-MM' oder null = alle

    // Vormonat-Stimmen aus Archiv laden
    const { data, error } = await supabase
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
