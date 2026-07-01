// frontend/src/app/api/bookings/route.ts
// ARCH-006.1 — Single Source of Truth: bookings + stripe_payments + profiles + works/projects + commissions
// via rpc_get_all_bookings / rpc_get_booking_details. Ersetzt die alte rohe .from('bookings').select('*'),
// die weder Nutzer/Wirker-Namen, Zahlungsdaten, Provisionen noch Impact-Daten mitlieferte.
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || searchParams.get('status') || 'all';

    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_all_bookings', {
      p_filter: filter,
      p_limit:  limit,
      p_offset: offset,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error || 'unknown' }, { status: 500 });

    return NextResponse.json({
      ok: true,
      bookings: data.bookings ?? [],
      total: data.total ?? 0,
      limit: data.limit,
      offset: data.offset,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Detailansicht einer einzelnen Buchung — vollstaendig gejoint
// (User, Wirker, Werk/Talent/Projekt, Stripe-Zahlung, Impact-Pool, Ambassador-Provision)
export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) return NextResponse.json({ ok: false, error: 'booking_id erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_booking_details', { p_booking_id: booking_id });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
