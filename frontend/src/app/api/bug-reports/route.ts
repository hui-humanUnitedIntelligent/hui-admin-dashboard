// frontend/src/app/api/bug-reports/route.ts
// ── Bug Reports Admin API (2026-08-19) ───────────────────────────────────────
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return fail(error.message, 500);
    return ok(data || []);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || typeof id !== 'string') return fail('ID fehlt', 400);

    const client = getServiceClient();

    if (action === 'update_status') {
      const { status } = body;
      if (!['offen', 'in_bearbeitung', 'gelöst'].includes(status)) {
        return fail('Ungültiger Status', 400);
      }
      const { data, error } = await client
        .from('bug_reports')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, status, user_id, email, username, description')
        .single();
      if (error) return fail(error.message, 500);

      // ── BUG-RESOLVED-NOTIFY-001 (2026-09-06) ────────────────────────────
      // Rückmeldung an den Melder NUR beim expliziten Schließen ("gelöst").
      // NICHT bei 'offen'/'in_bearbeitung' und NICHT beim Löschen
      // (DELETE-Handler weiter unten bleibt unberührt).
      if (status === 'gelöst') {
        const desc = String(data.description ?? '').trim();
        const excerpt = desc.slice(0, 140);
        const suffix = desc.length > 140 ? '…' : '';

        if (data.user_id) {
          // Fall A: Konto existiert → In-App-Notification im Resonanzzentrum
          // (gleiche Tabelle/Mechanismus wie support_ticket_reply).
          try {
            await client.from('notifications').insert({
              user_id:     data.user_id,
              type:        'bug_report_resolved',
              title:       'Dein gemeldeter Fehler wurde behoben',
              body:        excerpt ? `„${excerpt}${suffix}" wurde behoben.` : 'Dein gemeldetes Problem wurde behoben.',
              data: {
                bug_report_id:        data.id,
                description_excerpt:  excerpt,
                description_full:     data.description ?? '',
              },
              // metadata ist die Quelle, die das App-DetailModal liest
              // (parseMeta(n.metadata) in NotificationPanel.jsx)
              metadata: {
                bug_report_id:        data.id,
                description_excerpt:  excerpt,
                description_full:     data.description ?? '',
              },
              is_read:     false,
              entity_type: 'bug_report',
              entity_id:   data.id,
            });
          } catch { /* Notification-Fehler blockiert das Schließen nicht */ }
        } else if (data.email) {
          // Fall B: Konto gelöscht (bug_reports.user_id = ON DELETE SET NULL
          // auf auth.users) → E-Mail ist der einzig verbleibende Kanal.
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hui-admin-dashboard.vercel.app';
            await fetch(`${appUrl}/api/send-email`, {
              method:  'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie':       req.headers.get('cookie') ?? '',
              },
              body: JSON.stringify({
                template:            'bug_report_resolved',
                to:                  data.email,
                name:                data.username || 'Nutzer',
                description_excerpt: excerpt ? `${excerpt}${suffix}` : '',
              }),
            }).catch(() => {});
          } catch { /* E-Mail-Fehler nicht kritisch */ }
        }
      }

      return ok({ id: data.id, status: data.status });
    }

    return fail('Unbekannte Aktion', 400);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { id } = body;
    if (!id || typeof id !== 'string') return fail('ID fehlt', 400);

    const client = getServiceClient();
    const { error } = await client.from('bug_reports').delete().eq('id', id);
    if (error) return fail(error.message, 500);

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
