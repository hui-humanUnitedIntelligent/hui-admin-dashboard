// IMPACT-VOTING v2: Monthly Project Selection API
// Admin wählt 3 Projekte pro Monat für das Voting
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_monthly_projects', { p_pool_month: month });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true, data: data ?? [], month });
  } catch(e) {
    return NextResponse.json({ ok:false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { project_id, pool_month } = body;
    if (!project_id || !pool_month) return NextResponse.json({ ok:false, error:'project_id + pool_month required' }, { status: 400 });
    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_select_monthly_project', {
      p_project_id: project_id, p_pool_month: pool_month, p_position: 0,
    });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { ok: true });
  } catch(e) {
    return NextResponse.json({ ok:false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { project_id, pool_month } = body;
    if (!project_id || !pool_month) return NextResponse.json({ ok:false, error:'project_id + pool_month required' }, { status: 400 });
    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_remove_monthly_project', {
      p_project_id: project_id, p_pool_month: pool_month,
    });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { ok: true });
  } catch(e) {
    return NextResponse.json({ ok:false, error: String(e) }, { status: 500 });
  }
}
