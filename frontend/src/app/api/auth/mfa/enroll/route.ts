// frontend/src/app/api/auth/mfa/enroll/route.ts
// GET /api/auth/mfa/enroll
// Startet TOTP-Enrollment für die Pending-2FA-Session (nach Passwort-Login, vor finalem Cookie).
// Räumt zuerst evtl. vorhandene unverifizierte TOTP-Faktoren auf (idempotent bei Reload/Retry),
// dann wird ein neuer Faktor erzeugt und QR-Code + Secret zurückgegeben.

import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient } from '@/app/lib/supabase-server';

function readPending(req: NextRequest): { at: string; rt: string; role: string; dest: string } | null {
  const raw = req.cookies.get('hui_mfa_pending')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const pending = readPending(req);
  if (!pending) {
    return NextResponse.json({ ok: false, error: 'Sitzung abgelaufen. Bitte erneut einloggen.' }, { status: 401 });
  }

  const supabase = getAnonClient();
  const { error: sessErr } = await supabase.auth.setSession({ access_token: pending.at, refresh_token: pending.rt });
  if (sessErr) {
    return NextResponse.json({ ok: false, error: 'Sitzung ungültig. Bitte erneut einloggen.' }, { status: 401 });
  }

  // Aufräumen: unverifizierte TOTP-Faktoren aus vorherigen Versuchen entfernen
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const stale = (factorsData?.all || []).filter(f => f.factor_type === 'totp' && f.status === 'unverified');
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  } catch { /* nicht kritisch, enroll versucht es trotzdem */ }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'HUI Admin Dashboard',
  });

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || 'Einrichtung fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    factorId: data.id,
    qr_svg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  });
}
