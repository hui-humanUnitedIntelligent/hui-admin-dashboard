// frontend/src/app/api/website-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const TABLE = 'website_reviews';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sb = getServiceClient();
    let q = sb.from(TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.or(`name.ilike.%${search}%,message.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) {
      // Tabelle existiert noch nicht
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return NextResponse.json({ reviews: [], total: 0, tableExists: false });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ reviews: data ?? [], total: count ?? 0, tableExists: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });
    const allowed: Record<string, unknown> = {};
    for (const k of ['name','email','message','stars','status','is_featured','page']) {
      if (k in updates) allowed[k] = updates[k];
    }
    allowed.updated_at = new Date().toISOString();
    const sb = getServiceClient();
    const { error } = await sb.from(TABLE).update(allowed).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Oeffentlicher Endpunkt fuer Webseiten-Formular (kein Guard)
  try {
    const body = await req.json();
    const { name, email, message, stars, page, source } = body;
    if (!message?.trim()) return NextResponse.json({ ok: false, error: 'Nachricht fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { data, error } = await sb.from(TABLE).insert({
      name: name?.trim() || 'Anonym',
      email: email?.trim() || null,
      message: message.trim(),
      stars: stars ?? null,
      page: page ?? null,
      source: source ?? 'website',
      status: 'published',
    }).select('id').single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
