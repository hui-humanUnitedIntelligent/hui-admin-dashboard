// frontend/src/app/api/auth/mfa/admin-reset/route.ts
// POST /api/auth/mfa/admin-reset   { userId }
// Superadmin-only: entfernt alle TOTP-Faktoren eines anderen Accounts (verloren gegangenes
// Authenticator-Gerät). Nutzt die Supabase Admin-API direkt über Service-Role — braucht
// KEINE Session des Ziel-Accounts. Der betroffene Nutzer muss sich beim nächsten Login
// erneut per QR-Code einrichten (2FA bleibt Pflicht, nur der alte Faktor wird gelöscht).

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId fehlt' }, { status: 400 });
    }

    const sb = getServiceClient();

    const { data: factorsData, error: listErr } = await sb.auth.admin.mfa.listFactors({ userId });
    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 });
    }

    const factors = factorsData?.factors ?? [];
    let removed = 0;
    for (const f of factors) {
      const { error: delErr } = await sb.auth.admin.mfa.deleteFactor({ id: f.id, userId });
      if (!delErr) removed++;
    }

    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
