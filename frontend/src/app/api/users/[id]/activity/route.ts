// frontend/src/app/api/users/[id]/activity/route.ts
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
        .select('bio, tagline, location, location_label, dna_tags')
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

    const p = profileRes.data;
    const works       = worksRes.data       ?? [];
    const experiences = experiencesRes.data ?? [];
    const projects    = projectsRes.data    ?? [];

    return NextResponse.json({
      bio:         p?.bio          ?? null,
      tagline:     p?.tagline      ?? null,
      location:    p?.location_label ?? p?.location ?? null,
      tags:        Array.isArray(p?.dna_tags) ? p.dna_tags : (p?.dna_tags ? JSON.parse(String(p.dna_tags)) : []),
      counts: {
        works:       works.length,
        experiences: experiences.filter((e: Record<string,unknown>) => e.experience_type !== 'projekt').length,
        projects_exp:experiences.filter((e: Record<string,unknown>) => e.experience_type === 'projekt').length,
        impact:      projects.length,
        total:       works.length + experiences.length + projects.length,
      },
      works,
      experiences,
      projects,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
