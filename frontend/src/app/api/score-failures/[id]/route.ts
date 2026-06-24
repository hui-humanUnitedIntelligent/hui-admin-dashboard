// frontend/src/app/api/score-failures/[id]/route.ts
// ── Server-only — Service Role Key nie im Client-Bundle ───────────────────
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function headers() {
  return {
    apikey:          SERVICE_KEY,
    Authorization:   `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

// PATCH: Felder eines Score-Failures aktualisieren
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key missing' }, { status: 500 });
  }
  try {
    const body = await req.json();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/impact_score_failures?id=eq.${params.id}`,
      { method: 'PATCH', headers: headers(), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: Score-Failure-Eintrag löschen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key missing' }, { status: 500 });
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/impact_score_failures?id=eq.${params.id}`,
      { method: 'DELETE', headers: headers() }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
