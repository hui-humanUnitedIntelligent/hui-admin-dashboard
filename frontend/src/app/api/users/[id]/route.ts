// frontend/src/app/api/users/[id]/route.ts
// PATCH /api/users/:id — block, unblock, delete, restore
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

// Standardtext, der versendet wird, wenn der Admin KEINEN eigenen Blockierungsgrund
// einträgt. Schreibt der Admin einen Text, wird genau dieser an den Nutzer gesendet.
const DEFAULT_BLOCK_MESSAGE = 'Dein Konto wird von einem Admin geprüft. Bei Fragen: support@be-hui.com';
const DEFAULT_DELETE_MESSAGE = 'Dein HUI-Konto wurde deaktiviert und in den Gelöscht-Bereich verschoben. Bei Fragen: support@be-hui.com';

// Sendet die Blockierungs-/Löschungs-Benachrichtigung per E-Mail via Resend.
// Nicht-blockierend fuer den eigentlichen Request: Fehler werden nur geloggt,
// damit ein E-Mail-Problem niemals das Blockieren/Löschen selbst verhindert.
async function sendAccountStatusEmail(opts: {
  to: string | null | undefined;
  name: string;
  message: string;
  action: 'block' | 'delete';
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
  if (!RESEND_API_KEY || !opts.to) {
    if (!RESEND_API_KEY) console.warn('[sendAccountStatusEmail] RESEND_API_KEY fehlt — E-Mail nicht gesendet.');
    return;
  }

  const FROM_EMAIL = 'HUI Support <support@be-hui.com>';
  const subject = opts.action === 'delete'
    ? 'Dein HUI-Konto wurde in den Gelöscht-Bereich verschoben'
    : 'Dein HUI-Konto wurde blockiert';
  const introLine = opts.action === 'delete'
    ? 'dein Konto wurde von einem Admin deaktiviert und in den Gelöscht-Bereich verschoben.'
    : 'dein Konto wurde von einem Admin blockiert.';

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#16D7C5,#0fb8a8);padding:28px 32px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:white;letter-spacing:-0.5px">HUI</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">Human United Intelligent</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1a1a">
            Hallo ${opts.name},
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">
            ${introLine}
          </p>

          <!-- Nachricht -->
          <div style="background:rgba(246,173,85,0.08);border:1.5px solid rgba(246,173,85,0.3);
            border-radius:10px;padding:16px 18px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#c9791a;
              text-transform:uppercase;letter-spacing:0.08em">
              ⚠️ HINWEIS VOM HUI-TEAM
            </p>
            <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap">${opts.message.replace(/\n/g,'<br>')}</p>
          </div>

          <p style="margin:0;font-size:12px;color:#999;line-height:1.6">
            Bei Fragen erreichst du uns jederzeit unter
            <a href="mailto:support@be-hui.com" style="color:#16D7C5;text-decoration:none">support@be-hui.com</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f7f4;padding:16px 32px;text-align:center;
          border-top:1px solid rgba(0,0,0,0.06)">
          <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6">
            HUI — Human United Intelligent ·
            <a href="mailto:support@be-hui.com" style="color:#16D7C5;text-decoration:none">support@be-hui.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [opts.to], subject, html }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[sendAccountStatusEmail] Resend-Fehler:', errBody);
    }
  } catch (e) {
    console.warn('[sendAccountStatusEmail] Senden fehlgeschlagen:', e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id } = params;
    const body   = await req.json() as { action: string; reason?: string };
    const { action, reason } = body;
    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // blocked_by = Admin-Blockiergrund (einzige existierende Text-Spalte für Grund).
    // Logik: Hat der Admin selbst einen Text geschrieben, wird GENAU dieser als Grund
    // gespeichert UND per E-Mail an den Nutzer versendet. Ist das Feld leer, wird der
    // Standardtext verwendet — für Speicherung und E-Mail identisch.
    let profileUpdate: Record<string, unknown> = {};
    const effectiveMessage = (reason && reason.trim()) ? reason.trim() : DEFAULT_BLOCK_MESSAGE;
    // Für Soft Delete: eigener Text des Admins, sonst Standard-Löschungs-Nachricht.
    // WICHTIG: Muss 'gelöscht' enthalten, damit die GET-API is_deleted=true ableitet.
    const deleteMessage = (reason && reason.trim()) ? reason.trim() : DEFAULT_DELETE_MESSAGE;

    if (action === 'block') {
      profileUpdate = {
        blocked:    true,
        blocked_at: now,
        blocked_by: effectiveMessage,
      };
    } else if (action === 'unblock' || action === 'restore') {
      // Unblock ODER Restore: beide Felder zurücksetzen, damit der Nutzer
      // wieder aktiv ist (egal ob er aus 'Blockiert' oder 'Gelöscht' kommt).
      profileUpdate = {
        blocked:    false,
        blocked_at: null,
        blocked_by: null,
      };
    } else if (action === 'delete') {
      // Soft Delete: Nutzer wird blockiert (Login verhindert) UND das blocked_by-
      // Feld enthält 'gelöscht', damit die GET-API is_deleted=true ableitet
      // (siehe /api/users Zeile: blocked_by?.toLowerCase().includes('gelöscht')).
      // Die E-Mail bekommt einen löschspezifischen Standardtext.
      profileUpdate = {
        blocked:    true,
        blocked_at: now,
        blocked_by: deleteMessage,
      };
    } else if (action === 'update_block_reason') {
      if (!reason) return ok({ ok: false, error: 'Kein Grund angegeben' });
      profileUpdate = { blocked_by: reason };
    } else {
      return ok({ ok: false, error: 'Unbekannte Aktion' });
    }

    // Bei block/delete gleichzeitig E-Mail/Name laden, um die Benachrichtigung senden zu können.
    const needsEmail = action === 'block' || action === 'delete';
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id)
      .select('email, full_name, display_name')
      .single();

    if (error) {
      console.error('[PATCH users] DB error:', error.message, '| update:', profileUpdate);
      throw error;
    }

    // Auth-User sperren (verhindert Login-Token-Refresh)
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (supabaseUrl && serviceKey) {
      if (action === 'block' || action === 'delete') {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: '87600h' }),
          });
        } catch (e) { console.warn('[PATCH] auth ban failed:', e); }
      }
      if (action === 'unblock' || action === 'restore') {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: 'none' }),
          });
        } catch (e) { console.warn('[PATCH] auth unban failed:', e); }
      }
    }

    // Blockierungs-/Löschungs-E-Mail an den Nutzer senden — mit dem individuellen
    // Grund des Admins, oder dem Standardtext, wenn kein Grund eingegeben wurde.
    if (needsEmail && updatedProfile?.email) {
      const displayName = updatedProfile.full_name || updatedProfile.display_name || 'Nutzer';
      await sendAccountStatusEmail({
        to: updatedProfile.email,
        name: displayName,
        message: action === 'delete' ? deleteMessage : effectiveMessage,
        action: action as 'block' | 'delete',
      });
    }

    return ok({ ok: true, action, id });

  } catch (err) {
    console.error('[PATCH users]', err);
    return serverError(err instanceof Error ? err.message : String(err));
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id } = params;
    const supabase   = getServiceClient();
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    // Profil löschen
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;

    // Auth-User löschen
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      });
    }

    return ok({ ok: true, deleted: id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : String(err));
  }
}
