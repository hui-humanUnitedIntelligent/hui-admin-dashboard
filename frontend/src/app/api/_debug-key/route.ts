// TEMP DEBUG ROUTE — wird nach Diagnose sofort wieder entfernt.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/app/lib/supabase-server';

function decodeJwtMeta(token: string | undefined) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return { ref: payload.ref, role: payload.role, iat: payload.iat, exp: payload.exp };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET() {
  const meta = decodeJwtMeta(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  const sb = getServiceClient();
  const { count, error } = await sb.from('impact_applications').select('id', { count: 'exact', head: true });
  const { data: allRows } = await sb.from('impact_applications').select('id,status,created_at');

  return NextResponse.json({
    keyMeta: meta,
    url,
    countExact: count,
    error: error?.message,
    allRows,
  });
}
