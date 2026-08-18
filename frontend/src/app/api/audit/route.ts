// frontend/src/app/api/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const tab    = searchParams.get('tab')    ?? 'notifications';
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const search = (searchParams.get('search') ?? '').toLowerCase().trim();

  const sb = getServiceClient();

  try {
    // ── Notifications ──────────────────────────────────────────────────────
    if (tab === 'notifications') {
      let q = sb.from('notifications')
        .select('id,user_id,type,title,body,is_read,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (search) q = q.or(`title.ilike.%${search}%,type.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Neue Registrierungen ───────────────────────────────────────────────
    if (tab === 'registrations') {
      let q = sb.from('profiles')
        .select('id,display_name,username,full_name,email,role,created_at', { count: 'exact' })
        .not('email', 'like', '%hui-commerce.test%')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (search) q = q.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Neue Werke ────────────────────────────────────────────────────────
    if (tab === 'works') {
      const { data, error, count } = await sb.from('works')
        .select('id,user_id,title,category,status,price_eur,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Erlebnisse ────────────────────────────────────────────────────────
    if (tab === 'experiences') {
      const { data, error, count } = await sb.from('experiences')
        .select('id,user_id,title,experience_type,status,price,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Impact Bewerbungen ─────────────────────────────────────────────────
    if (tab === 'impact') {
      const { data, error, count } = await sb.from('impact_applications')
        .select('id,user_id,project_name,contact_name,contact_email,status,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Talente (Angebote/Dienstleistungen, TALENT-OFFERS-001/TALENT-SERVICES-001) ──
    if (tab === 'talents') {
      let q = sb.from('talents')
        .select('id,user_id,title,category,status,location_type,price_per_hour,price_per_session,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (search) q = q.or(`title.ilike.%${search}%,category.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Messages / Chats ──────────────────────────────────────────────────
    if (tab === 'messages') {
      const { data, error, count } = await sb.from('messages')
        .select('id,chat_id,sender_id,sender_name,text,is_read,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    // ── Website Reviews ────────────────────────────────────────────────────
    if (tab === 'reviews') {
      const { data, error, count } = await sb.from('website_reviews')
        .select('id,name,username,stars,message,status,created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannter Tab' }, { status: 400 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
