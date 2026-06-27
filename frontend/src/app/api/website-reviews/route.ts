// frontend/src/app/api/website-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
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
    const status = searchParams.get('status') || 'all';
    const sb = getServiceClient();
    let q = sb.from(TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status !== 'all') q = q.eq('status', status);
    if (search) q = q.or(`name.ilike.%${search}%,message.ilike.%${search}%`);
    const { data, count, error } = await q;
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return NextResponse.json({ reviews: [], total: 0, tableExists: false });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    // Counts nach Status
    const { count: pendingCount } = await sb.from(TABLE).select('*',{count:'exact',head:true}).eq('status','pending');
    const { count: publishedCount } = await sb.from(TABLE).select('*',{count:'exact',head:true}).eq('status','published');
    const { count: rejectedCount } = await sb.from(TABLE).select('*',{count:'exact',head:true}).eq('status','rejected');
    return NextResponse.json({
      reviews: data ?? [], total: count ?? 0, tableExists: true,
      counts: { pending: pendingCount??0, published: publishedCount??0, rejected: rejectedCount??0 }
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, action, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });
    const sb  = getServiceClient();
    const now = new Date().toISOString();

    let patch: Record<string,unknown> = { updated_at: now };
    if (action === 'approve') {
      patch = { ...patch, status: 'published' };
    } else if (action === 'reject') {
      patch = { ...patch, status: 'rejected' };
    } else if (action === 'feature') {
      patch = { ...patch, is_featured: true };
    } else if (action === 'unfeature') {
      patch = { ...patch, is_featured: false };
    } else {
      // Direktes Update einzelner Felder
      for (const k of ['name','email','message','stars','status','is_featured','page']) {
        if (k in updates) patch[k] = updates[k];
      }
    }

    const { error } = await sb.from(TABLE).update(patch).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id, action });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
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
  // Oeffentlicher Eingang vom Webseiten-Formular (kein Guard)
  try {
    const body = await req.json();
    const { name, email, message, stars, page } = body;
    if (!message?.trim()) return NextResponse.json({ ok: false, error: 'Nachricht fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { data, error } = await sb.from(TABLE).insert({
      name:    name?.trim() || 'Anonym',
      email:   email?.trim() || null,
      message: message.trim(),
      stars:   stars ?? null,
      page:    page ?? null,
      source:  'website',
      status:  'pending',
    }).select('id').single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
