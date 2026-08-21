import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { endpoint, keys, userEmail } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const sb = getServiceClient();

    // Upsert subscription (update if exists, insert if new)
    const { error } = await sb
      .from('sadb_push_subscriptions')
      .upsert({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_email: userEmail || null,
        is_active: true,
      }, {
        onConflict: 'endpoint',
      });

    if (error) {
      console.error('[push/subscribe] DB error:', error.message);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push/subscribe] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
