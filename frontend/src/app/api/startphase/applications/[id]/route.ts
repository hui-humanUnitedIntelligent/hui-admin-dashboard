// frontend/src/app/api/startphase/applications/[id]/route.ts
// HUI Startphase — Einzelne Bewerbung abrufen + Status ändern (Admin only)
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';
import { ok, fail, serverError, notFound } from '@/app/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from('startphase_applications')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) return notFound('Bewerbung');

    return ok({ application: data });
  } catch (err) {
    return serverError(err, 'startphase-applications-detail');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as { status?: string; admin_notes?: string };
    const sb = getServiceClient();

    const updateData: Record<string, unknown> = {};

    // Status validieren
    if (body.status) {
      const validStatuses = ['new', 'review', 'question', 'accepted', 'rejected', 'completed'];
      if (!validStatuses.includes(body.status)) {
        return fail(`Ungültiger Status: ${body.status}. Erlaubt: ${validStatuses.join(', ')}`);
      }
      updateData.status = body.status;
    }

    // Admin-Notizen
    if (body.admin_notes !== undefined) {
      updateData.admin_notes = body.admin_notes;
    }

    if (Object.keys(updateData).length === 0) {
      return fail('Keine Daten zum Aktualisieren');
    }

    const { data, error } = await sb.from('startphase_applications')
      .update(updateData)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error || !data) return fail('Aktualisierung fehlgeschlagen', 500);

    return ok({ application: data });
  } catch (err) {
    return serverError(err, 'startphase-applications-update');
  }
}
