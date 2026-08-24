import { NextRequest, NextResponse } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }
  return NextResponse.json({ publicKey });
}
