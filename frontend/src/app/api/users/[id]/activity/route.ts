// frontend/src/app/api/users/[id]/activity/route.ts
// GET /api/users/:id/activity — Bio, Werke, Erlebnisse, Projekte eines Nutzers
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id } = params;
    const sb = getServiceClient();

    const [profileRes, worksRes, experiencesRes, projectsRes] = await Promise.all([
      sb.from('profiles')
        .select('bio, location_text, tags, social_links')
        .eq('id', id)
        .single(),

      sb.from('works')
        .select('id, title, status, price, category, visibility, created_at, cover_url')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      sb.from('experiences')
        .select('id, title, status, price, experience_type, category, date, created_at, cover_url')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      sb.from('projects')
        .select('id, title, status, category, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      bio:         profileRes.data?.bio         ?? null,
      location:    profileRes.data?.location_text ?? null,
      tags:        profileRes.data?.tags         ?? [],
      works:       worksRes.data       ?? [],
      experiences: experiencesRes.data ?? [],
      projects:    projectsRes.data    ?? [],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
