// frontend/src/app/api/notifications/route.ts
// ── Server-only POST — einzelne Notification einfügen ─────────────────────
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const H = {
  apikey:          SERVICE_KEY,
  Authorization:   `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
  Prefer:          'return=minimal',
};

// POST: Einzelne Notification einfügen (z.B. Impact-Antrags-Benachrichtigung)
// ── Auth-Guard ────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { user: null, error: 'Unauthorized' };

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey:        supabaseAnon,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return { user: null, error: 'Unauthorized' };

  const data = await res.json().catch(() => null);
  if (!data?.id) return { user: null, error: 'Unauthorized' };

  return { user: { id: data.id, email: data.email } };
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req);
  if (!user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key missing' }, { status: 500 });
  }
  try {
    // Akzeptiert { notification: {...} } oder direkt das Payload-Objekt
    const body = await req.json();
    const payload = body.notification ?? body;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: H,
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
