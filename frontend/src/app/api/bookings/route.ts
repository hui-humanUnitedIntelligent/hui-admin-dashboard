// frontend/src/app/api/bookings/route.ts
// ARCH-007 — Vereinheitlichte Buchungsübersicht: TALENTE + ERLEBNISSE, live aus der App.
// Quellen (beide werden zusammengeführt, damit auch NUR angelegte / noch offene
// Zahlungen sichtbar sind — nicht erst nach abgeschlossenem Stripe-Webhook):
//   1. talent_bookings   -> Talent-Session-Buchungen (join talents + profiles)
//   2. buyer_order_status -> Erlebnis-/Werk-Käufe aus dem Marktplatz-Checkout
//      (order_items[].item_type === 'experience' | 'work', join experiences/profiles)
// Ersetzt die vorherige rpc_get_all_bookings-Anbindung, die ausschliesslich
// talent_bookings/legacy 'bookings' abgedeckt und Erlebnis-Käufe (inkl. "pending",
// da vor Stripe-Bestätigung noch kein stripe_payments-Row existiert) NICHT gezeigt hat.
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

type AnyRec = Record<string, unknown>;

interface UnifiedBooking {
  booking_id: string;
  source: 'talent' | 'experience' | 'work';
  type: string;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at?: string | null;

  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;

  wirker_id: string | null;
  wirker_name?: string | null;
  wirker_email?: string | null;

  item_title?: string | null;
  amount: number;
  currency?: string;
  platform_fee: number;
  impact_fee: number;
  ambassador_commission?: number;
  payment_id?: string | null;

  // Event-/Termin-Infos (v.a. Erlebnisse + Talent-Sessions)
  event_date?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  location?: string | null;
  participants?: number | null;
  spots_available?: number | null;
  max_participants?: number | null;

  metadata?: AnyRec | null;
}

const TYPE_STATUS_MAP: Record<string, string[]> = {
  confirmed: ['confirmed', 'paid'],
  pending:   ['pending', 'pending_payment'],
  cancelled: ['cancelled', 'canceled', 'failed'],
  completed: ['completed', 'delivered'],
};

function mapTalentBooking(row: AnyRec, talentTitleMap: Map<string, AnyRec>): UnifiedBooking {
  const talent = talentTitleMap.get(String(row.talent_id));
  return {
    booking_id: `tb_${row.id}`,
    source: 'talent',
    type: 'talent',
    status: String(row.status ?? 'pending'),
    payment_status: String(row.status ?? 'pending'),
    created_at: String(row.created_at),
    updated_at: (row.updated_at as string) ?? null,
    user_id: (row.customer_id as string) ?? null,
    wirker_id: (row.seller_id as string) ?? null,
    item_title: (talent?.title as string) ?? null,
    amount: Number(row.amount_eur ?? 0),
    currency: String(row.currency ?? 'EUR'),
    platform_fee: Number(row.company_share_eur ?? 0),
    impact_fee: 0,
    ambassador_commission: Number(row.ambassador_commission_eur ?? 0),
    payment_id: (row.stripe_payment_intent as string) ?? null,
    event_date: (row.selected_date as string) ?? null,
    time_start: (row.selected_time_slot as string) ?? null,
    time_end: null,
    location: (talent?.location_address as string) ?? null,
    participants: (row.participants as number) ?? null,
    spots_available: null,
    max_participants: null,
    metadata: { escrow_status: row.escrow_status, delivery_status: row.delivery_status },
  };
}

function mapOrderItem(
  order: AnyRec,
  item: AnyRec,
  experienceMap: Map<string, AnyRec>
): UnifiedBooking {
  const itemType = String(item.item_type ?? 'work');
  const snapshot = (item.snapshot as AnyRec) ?? {};
  const exp = itemType === 'experience' ? experienceMap.get(String(snapshot.item_id)) : undefined;
  const qty = Number(item.quantity ?? 1);
  const unitPrice = Number(snapshot.price_eur ?? snapshot.unit_price_eur ?? 0);

  return {
    booking_id: `bos_${order.id}_${item.id ?? snapshot.item_id ?? '0'}`,
    source: itemType === 'experience' ? 'experience' : 'work',
    type: itemType,
    status: String(order.state ?? order.status ?? 'pending'),
    payment_status: String(order.status ?? order.state ?? 'pending'),
    created_at: String(order.created_at),
    updated_at: (order.payment_confirmed_at as string) ?? null,
    user_id: (order.buyer_id as string) ?? (order.customer_id as string) ?? null,
    wirker_id: (snapshot.seller_id as string) ?? (item.seller_id as string) ?? null,
    item_title: (snapshot.title as string) ?? null,
    amount: unitPrice * qty,
    currency: 'EUR',
    platform_fee: Number(order.commission_eur ?? snapshot.commission_eur ?? 0),
    impact_fee: Number(order.impact_eur ?? snapshot.impact_eur ?? 0),
    ambassador_commission: 0,
    payment_id: (order.stripe_payment_intent as string) ?? null,
    event_date: exp ? (exp.date as string) ?? null : null,
    time_start: exp ? (exp.time_start as string) ?? null : null,
    time_end: exp ? (exp.time_end as string) ?? null : null,
    location: exp ? (exp.location_text as string) ?? null : null,
    participants: qty,
    spots_available: exp ? (exp.spots_available as number) ?? null : null,
    max_participants: exp ? ((exp.max_participants as number) ?? (exp.participant_limit as number) ?? null) : null,
    metadata: { order_id: order.id, fulfillment_status: item.fulfillment_status },
  };
}

async function loadUnifiedBookings(sb: ReturnType<typeof getServiceClient>) {
  const [tbRes, bosRes] = await Promise.all([
    sb.from('talent_bookings').select('*').order('created_at', { ascending: false }).limit(1000),
    sb.from('buyer_order_status').select('*').order('created_at', { ascending: false }).limit(1000),
  ]);

  const talentBookings = (tbRes.data as AnyRec[]) ?? [];
  const orders = (bosRes.data as AnyRec[]) ?? [];

  // Talents + Experiences fuer Titel/Termin-Anreicherung nachladen
  const talentIds = [...new Set(talentBookings.map((r) => String(r.talent_id)).filter(Boolean))];
  const expIds = [...new Set(
    orders.flatMap((o) => ((o.order_items as AnyRec[]) ?? [])
      .filter((it) => it.item_type === 'experience')
      .map((it) => String((it.snapshot as AnyRec)?.item_id))
    ).filter(Boolean)
  )];

  const [talentsRes, expRes] = await Promise.all([
    talentIds.length ? sb.from('talents').select('id,title,location_address').in('id', talentIds) : Promise.resolve({ data: [] }),
    expIds.length ? sb.from('experiences').select('id,date,time_start,time_end,location_text,spots_available,max_participants,participant_limit').in('id', expIds) : Promise.resolve({ data: [] }),
  ]);

  const talentTitleMap = new Map(((talentsRes.data as AnyRec[]) ?? []).map((t) => [String(t.id), t]));
  const experienceMap = new Map(((expRes.data as AnyRec[]) ?? []).map((e) => [String(e.id), e]));

  const unified: UnifiedBooking[] = [
    ...talentBookings.map((r) => mapTalentBooking(r, talentTitleMap)),
    ...orders.flatMap((o) => ((o.order_items as AnyRec[]) ?? []).map((it) => mapOrderItem(o, it, experienceMap))),
  ];

  // Profile (Namen/E-Mails) fuer alle beteiligten User anreichern
  const userIds = [...new Set(unified.flatMap((b) => [b.user_id, b.wirker_id]).filter(Boolean))] as string[];
  const profilesRes = userIds.length
    ? await sb.from('profiles').select('id,full_name,display_name,username,email').in('id', userIds)
    : { data: [] };
  const profileMap = new Map(((profilesRes.data as AnyRec[]) ?? []).map((p) => [String(p.id), p]));

  for (const b of unified) {
    if (b.user_id) {
      const p = profileMap.get(b.user_id);
      b.user_name = (p?.display_name as string) || (p?.full_name as string) || (p?.username as string) || null;
      b.user_email = (p?.email as string) ?? null;
    }
    if (b.wirker_id) {
      const p = profileMap.get(b.wirker_id);
      b.wirker_name = (p?.display_name as string) || (p?.full_name as string) || (p?.username as string) || null;
      b.wirker_email = (p?.email as string) ?? null;
    }
  }

  unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return unified;
}

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || searchParams.get('status') || 'all';
    const typeFilter = searchParams.get('type') || 'all';

    const sb = getServiceClient();
    let unified = await loadUnifiedBookings(sb);

    if (filter !== 'all') {
      const allowed = TYPE_STATUS_MAP[filter] ?? [filter];
      unified = unified.filter((b) => allowed.includes(b.status));
    }
    if (typeFilter !== 'all') {
      unified = unified.filter((b) => b.type === typeFilter || b.source === typeFilter);
    }

    const total = unified.length;
    const totalVolume = unified.reduce((s, b) => s + (b.amount || 0), 0);
    const totalImpact = unified.reduce((s, b) => s + (b.impact_fee || 0), 0);
    const completed = unified.filter((b) => TYPE_STATUS_MAP.confirmed.includes(b.status) || TYPE_STATUS_MAP.completed.includes(b.status)).length;

    const page = unified.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      bookings: page,
      total,
      limit,
      offset,
      totalVolume,
      totalImpact,
      completed,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Detailansicht — vollstaendig angereicherte Einzelbuchung (Talent ODER Erlebnis/Werk)
export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) return NextResponse.json({ ok: false, error: 'booking_id erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    const unified = await loadUnifiedBookings(sb);
    const booking = unified.find((b) => b.booking_id === booking_id);
    if (!booking) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
