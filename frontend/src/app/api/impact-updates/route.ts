// frontend/src/app/api/impact-updates/route.ts
// Liefert Projekt-Updates für ein Impact-Projekt
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ data: [] });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from('impact_project_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
