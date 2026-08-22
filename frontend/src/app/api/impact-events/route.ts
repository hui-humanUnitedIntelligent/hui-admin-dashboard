// IMPACT-VOTING v2: Impact Events Log API
// Liefert die 5 Event-Typen für SADB-Transparenz
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const eventType = searchParams.get('event_type');
    const sb = getServiceClient();
    let q = sb.from('impact_events').select('*').order('created_at', { ascending: false }).limit(limit);
    if (eventType) q = q.eq('event_type', eventType);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true, data: data ?? [] });
  } catch(e) {
    return NextResponse.json({ ok:false, error: String(e) }, { status: 500 });
  }
}
