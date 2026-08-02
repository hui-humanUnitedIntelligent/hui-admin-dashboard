// frontend/src/app/api/recommendation-reports/[id]/route.ts
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();
  const body = await req.json();

  // Status aktualisieren
  if (body.status) {
    const validStatuses = ['new', 'in_progress', 'resolved'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const { data, error } = await sb
      .from('recommendation_reports')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Empfehlung endgültig löschen
  if (body.deleteRecommendation && body.recommendationId) {
    const { error } = await sb
      .from('recommendations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', body.recommendationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: true });
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 });
}
