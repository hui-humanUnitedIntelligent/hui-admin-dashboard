// frontend/src/app/api/notifications/route.ts
// ── Server-only POST — einzelne Notification einfügen ─────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminHeaders = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:         'return=minimal',
};

// POST: Einzelne Notification einfügen (z.B. Impact-Antrags-Benachrichtigung)
export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key missing' }, { status: 500 });
  }
  try {
    // Akzeptiert { notification: {...} } oder direkt das Payload-Objekt
    const body = await req.json();
    const payload = body.notification ?? body;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
