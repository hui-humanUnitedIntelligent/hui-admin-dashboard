// frontend/src/app/api/escrow/route.ts
// Admin-Interface für Escrow-Disputes und Freigaben
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/app/lib/auth-guard'
import { getServiceClient } from '@/app/lib/supabase-server'

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'disputes'
  const sb = getServiceClient()

  if (type === 'disputes') {
    const { data, count } = await sb
      .from('escrow_disputes')
      .select(`
        *,
        initiator:profiles!initiated_by(id,display_name,email),
        admin_user:profiles!admin_id(id,display_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ ok: true, disputes: data ?? [], total: count ?? 0 })
  }

  if (type === 'escrow_orders') {
    // Orders im holding-Status
    const { data } = await sb
      .from('orders')
      .select('id, state, escrow_status, delivery_status, total_eur, buyer_confirmed_at, payout_requested_at, created_at, auto_confirm_at')
      .eq('escrow_status', 'holding')
      .order('created_at', { ascending: false })
      .limit(50)
    return NextResponse.json({ ok: true, orders: data ?? [] })
  }

  if (type === 'stats') {
    const [holding, released, disputed] = await Promise.all([
      sb.from('orders').select('total_eur', { count: 'exact' }).eq('escrow_status', 'holding'),
      sb.from('orders').select('total_eur', { count: 'exact' }).eq('escrow_status', 'released'),
      sb.from('escrow_disputes').select('*', { count: 'exact' }).eq('status', 'open'),
    ])
    const holdingEur = (holding.data ?? []).reduce((s, o) => s + (Number(o.total_eur) || 0), 0)
    const releasedEur = (released.data ?? []).reduce((s, o) => s + (Number(o.total_eur) || 0), 0)
    return NextResponse.json({
      ok: true,
      holding: { count: holding.count ?? 0, eur: holdingEur },
      released: { count: released.count ?? 0, eur: releasedEur },
      open_disputes: disputed.count ?? 0,
    })
  }

  return NextResponse.json({ ok: false, error: 'Unbekannter type' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req)
  if (guard) return guard

  const sb = getServiceClient()
  const { dispute_id, decision, admin_note } = await req.json()

  if (!dispute_id || !decision) {
    return NextResponse.json({ ok: false, error: 'dispute_id + decision erforderlich' }, { status: 400 })
  }

  const { data, error } = await sb.rpc('rpc_admin_release_escrow', {
    p_dispute_id: dispute_id,
    p_decision: decision,
    p_admin_note: admin_note ?? null,
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
