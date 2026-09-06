// frontend/src/app/api/send-email/route.ts
// Sendet E-Mails via Resend API
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
// Fallback: onboarding@resend.dev nur für Tests; Produktion: support@be-hui.com
const FROM_EMAIL = 'HUI Support <support@be-hui.com>';
const FROM_FALLBACK = 'HUI Support <onboarding@resend.dev>';

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as {
      to:      string;
      name:    string;
      subject: string;
      reply:   string;
      ticket_number: string;
      original_message?: string;
    };

    if (!body.to || !body.reply) return fail('to und reply erforderlich');
    if (!RESEND_API_KEY) return fail('RESEND_API_KEY nicht konfiguriert');

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
            Hallo ${body.name},
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">
            dein Support-Ticket wurde beantwortet. Hier ist die Antwort unseres Teams:
          </p>

          <!-- Ticket Badge -->
          <div style="background:#f9f7f4;border-radius:8px;padding:10px 14px;margin-bottom:20px;
            display:inline-block;font-family:monospace;font-size:12px;font-weight:700;color:#16D7C5">
            ${body.ticket_number}
          </div>

          ${body.original_message ? `
          <!-- Deine Nachricht -->
          <div style="background:#f9f7f4;border-radius:10px;padding:14px 16px;margin-bottom:16px">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em">
              DEINE NACHRICHT
            </p>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.6">${body.original_message.replace(/\n/g,'<br>')}</p>
          </div>
          ` : ''}

          <!-- Support Antwort -->
          <div style="background:rgba(22,215,197,0.06);border:1.5px solid rgba(22,215,197,0.25);
            border-radius:10px;padding:16px 18px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#16D7C5;
              text-transform:uppercase;letter-spacing:0.08em">
              ✅ ANTWORT VOM HUI-SUPPORT
            </p>
            <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap">${body.reply.replace(/\n/g,'<br>')}</p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:24px">
            <a href="https://be-hui.com/studio?section=tickets"
              style="display:inline-block;background:linear-gradient(135deg,#16D7C5,#0fb8a8);
                color:white;text-decoration:none;padding:13px 28px;border-radius:10px;
                font-weight:700;font-size:14px;letter-spacing:0.2px">
              📱 In der HUI-App ansehen
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#999;line-height:1.6">
            Du kannst direkt in der App unter <strong>Mein HUI → Studio → Meine Tickets</strong> 
            auf diese Nachricht antworten oder weitere Fragen stellen.
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

    const fromAddr = FROM_EMAIL; // be-hui.com muss DNS-verifiziert sein

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    fromAddr,
        to:      [body.to],
        subject: `Re: [${body.ticket_number}] ${body.subject}`,
        html,
      }),
    });

    const result = await res.json() as { id?:string; name?:string; message?:string; statusCode?:number };

    // Falls Domain noch nicht verifiziert → Fallback mit onboarding@resend.dev (nur an eigene E-Mail)
    if (result.statusCode === 403 || result.name === 'validation_error') {
      // Sende zumindest an die registrierte Resend-E-Mail als Fallback
      const fallbackRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    FROM_FALLBACK,
          to:      ['huiwirken@gmail.com'],  // eigene E-Mail (Resend Test-Limit)
          subject: `[DOMAIN_UNVERIFIED] Ticket-Antwort für ${body.to}: [${body.ticket_number}]`,
          html:    `<p><strong>Domain noch nicht verifiziert!</strong></p>
                    <p>E-Mail sollte an: <strong>${body.to}</strong> gehen.</p>
                    <p>Bitte DNS-Records für be-hui.com in Resend verifizieren.</p>
                    <hr/>${html}`,
        }),
      });
      const fb = await fallbackRes.json() as { id?:string };
      return ok({ sent: false, fallback: true, id: fb.id, reason: result.message });
    }

    if (!res.ok) return serverError(result, 'send-email Resend error');
    return ok({ sent: true, id: result.id });

  } catch (err) {
    return serverError(err, 'send-email');
  }
}
