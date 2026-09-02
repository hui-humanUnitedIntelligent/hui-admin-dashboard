// frontend/src/app/api/startphase/communications/route.ts
// HUI Startphase — Kommunikation: Historie abrufen + E-Mail senden (Admin only)
// SICHERHEIT: Empfänger wird serverseitig aus der Bewerbung gelesen, NICHT vom Client.
import { NextRequest } from 'next/server';
import { guardAdmin, requireAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';
import { ok, fail, serverError, notFound } from '@/app/lib/api-response';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL = 'HUI Team <noreply@be-hui.com>';
const FROM_FALLBACK = 'HUI Team <onboarding@resend.dev>';

// ── GET: Kommunikationshistorie für eine Bewerbung ──
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const applicationId = searchParams.get('application_id');

    if (!applicationId) return fail('application_id erforderlich');

    const sb = getServiceClient();
    const { data, error } = await sb.from('startphase_communications')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) return fail(error.message, 500);

    return ok({ communications: data ?? [] });
  } catch (err) {
    return serverError(err, 'startphase-communications-get');
  }
}

// ── POST: E-Mail an Bewerber senden ──
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (!authResult.user) {
    return fail(authResult.error || 'Unauthorized', authResult.status || 401);
  }

  try {
    const body = await req.json() as {
      application_id: string;
      subject: string;
      message: string;
    };

    // Validierung
    if (!body.application_id) return fail('application_id erforderlich');
    if (!body.subject?.trim()) return fail('Betreff erforderlich');
    if (!body.message?.trim()) return fail('Nachricht erforderlich');

    // Nachricht-Länge begrenzen (Missbrauchsschutz)
    if (body.message.length > 5000) return fail('Nachricht zu lang (max. 5000 Zeichen)');
    if (body.subject.length > 200) return fail('Betreff zu lang (max. 200 Zeichen)');

    const sb = getServiceClient();

    // ── SICHERHEIT: Empfänger aus Datenbank lesen, NICHT vom Client ──
    const { data: application, error: appErr } = await sb.from('startphase_applications')
      .select('email, first_name, last_name')
      .eq('id', body.application_id)
      .single();

    if (appErr || !application) return notFound('Bewerbung');

    const recipientEmail = application.email;
    const recipientName = `${application.first_name} ${application.last_name}`.trim();

    // E-Mail Validierung (serverseitig)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return fail('Hinterlegte E-Mail-Adresse ist ungültig', 400, 'INVALID_EMAIL');
    }

    // ── Resend API Key Check ──
    if (!RESEND_API_KEY) {
      // Kommunikation trotzdem speichern (mit sent=false)
      const { data: commRecord } = await sb.from('startphase_communications').insert({
        application_id: body.application_id,
        admin_id: authResult.user.id,
        admin_name: authResult.user.email,
        direction: 'outbound',
        subject: body.subject.trim(),
        message_body: body.message.trim(),
        sent: false,
        error: 'RESEND_API_KEY nicht konfiguriert',
      }).select('*').single();

      return ok({
        sent: false,
        communication: commRecord,
        message: 'RESEND_API_KEY nicht konfiguriert — E-Mail nicht versendet. Kommunikation gespeichert.',
      });
    }

    // ── HTML E-Mail bauen ──
    const htmlBody = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Inter',system-ui,-apple-system,sans-serif;color:#141422;line-height:1.7">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="margin-bottom:24px">
    <img src="https://be-hui.com/hui_logo.webp" alt="HUI" width="36" height="36" style="border-radius:8px"/>
  </div>
  <h1 style="font-size:20px;font-weight:700;letter-spacing:-.01em;margin:0 0 20px;color:#141422">${body.subject}</h1>
  <div style="background:#FFF;border-radius:12px;padding:24px;border:1px solid rgba(20,20,34,.05);font-size:15px;color:#3A3A55;white-space:pre-wrap">${body.message}</div>
  <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(20,20,34,.05);font-size:13px;color:#8A8A9E">
    <p>HUI Team — Human United Intelligent</p>
    <p>Diese E-Mail wurde über das HUI Startphase-Dashboard gesendet.</p>
  </div>
</div>
</body>
</html>`;

    // ── Über Resend senden ──
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: body.subject.trim(),
        html: htmlBody,
        reply_to: 'noreply@be-hui.com',
      }),
    });

    const result = await res.json() as { id?: string; message?: string; statusCode?: number };

    // ── Fallback bei Domain-not-verified ──
    if (result.statusCode === 403 || (result.message && result.message.includes('verification'))) {
      const fallbackRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_FALLBACK,
          to: recipientEmail,
          subject: body.subject.trim(),
          html: htmlBody,
          reply_to: 'noreply@be-hui.com',
        }),
      });
      const fb = await fallbackRes.json() as { id?: string };

      // Kommunikation speichern
      const { data: commRecord } = await sb.from('startphase_communications').insert({
        application_id: body.application_id,
        admin_id: authResult.user.id,
        admin_name: authResult.user.email,
        direction: 'outbound',
        subject: body.subject.trim(),
        message_body: body.message.trim(),
        sent: fallbackRes.ok,
        resend_id: fb.id || null,
        error: fallbackRes.ok ? null : 'Fallback-Versand fehlgeschlagen',
      }).select('*').single();

      return ok({
        sent: fallbackRes.ok,
        fallback: true,
        id: fb.id,
        communication: commRecord,
      });
    }

    if (!res.ok) {
      // Fehler speichern
      const { data: commRecord } = await sb.from('startphase_communications').insert({
        application_id: body.application_id,
        admin_id: authResult.user.id,
        admin_name: authResult.user.email,
        direction: 'outbound',
        subject: body.subject.trim(),
        message_body: body.message.trim(),
        sent: false,
        error: result.message || `HTTP ${res.status}`,
      }).select('*').single();

      return ok({
        sent: false,
        communication: commRecord,
        error: result.message,
      });
    }

    // ── Erfolg: Kommunikation speichern ──
    const { data: commRecord } = await sb.from('startphase_communications').insert({
      application_id: body.application_id,
      admin_id: authResult.user.id,
      admin_name: authResult.user.email,
      direction: 'outbound',
      subject: body.subject.trim(),
      message_body: body.message.trim(),
      sent: true,
      resend_id: result.id || null,
    }).select('*').single();

    return ok({
      sent: true,
      id: result.id,
      communication: commRecord,
    });
  } catch (err) {
    return serverError(err, 'startphase-communications-send');
  }
}
