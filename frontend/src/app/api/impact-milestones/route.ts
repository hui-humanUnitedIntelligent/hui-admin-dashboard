// frontend/src/app/api/impact-milestones/route.ts
// Liefert Meilensteine für ein Impact-Projekt (inkl. verschachtelter Updates)
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ data: [] });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from('impact_milestones')
      .select('*, impact_milestone_updates(*)')
      .eq('project_id', projectId)
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
