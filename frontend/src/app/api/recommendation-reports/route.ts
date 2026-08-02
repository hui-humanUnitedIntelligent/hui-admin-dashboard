// frontend/src/app/api/recommendation-reports/route.ts
// Empfehlungs-Meldungen für SADB
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();
  const url = new URL(req.url);
  const status = url.searchParams.get('status'); // 'new' | 'in_progress' | 'resolved' | null

  let query = sb
    .from('recommendation_reports')
    .select(`
      id,
      recommendation_id,
      reporter_id,
      offender_id,
      message,
      reason,
      status,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });

  if (status && ['new', 'in_progress', 'resolved'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reporter + Offender Namen laden
  const userIds = [...new Set([
    ...data.map(r => r.reporter_id),
    ...data.map(r => r.offender_id),
  ])].filter(Boolean);

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Empfehlungstexte laden (falls noch nicht gelöscht)
  const recIds = data.map(r => r.recommendation_id).filter(Boolean);
  const { data: recs } = await sb
    .from('recommendations')
    .select('id, text, deleted_at, created_at')
    .in('id', recIds);

  const recMap = new Map(recs?.map(r => [r.id, r]) || []);

  const enriched = data.map(r => {
    const reporter = profileMap.get(r.reporter_id);
    const offender = profileMap.get(r.offender_id);
    const rec = recMap.get(r.recommendation_id);
    return {
      ...r,
      reporter_name: reporter?.display_name || reporter?.username || 'Unbekannt',
      reporter_avatar: reporter?.avatar_url || null,
      offender_name: offender?.display_name || offender?.username || 'Unbekannt',
      offender_avatar: offender?.avatar_url || null,
      recommendation_text: rec?.text || null,
      recommendation_deleted: rec?.deleted_at != null || false,
      recommendation_created_at: rec?.created_at || null,
    };
  });

  return NextResponse.json(enriched);
}
