// frontend/src/app/api/profiles/route.ts
// Server-side profiles query — uses SUPABASE_SERVICE_ROLE_KEY (nie im Browser exposed)

import { NextResponse } from 'next/server';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL         || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY         ||
                             process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

const PROFILE_SELECT = [
  'id,display_name,username,avatar_url,bio,tagline,role,membership_type',
  'is_wirker,is_member,membership_active,has_talent_profile,talent',
  'location,location_label,is_available,availability,impact_eur',
  'follower_count,followers_count,trust_score,is_guardian',
  'last_seen,last_seen_at,created_at,updated_at,skills,focus_type',
  'email,phone,full_name,is_talent,talent_since,talent_activated_at',
  'member_since,blocked,blocked_at,blocked_by,is_blocked,is_deleted,username_lower',
].join(',');

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[/api/profiles] Missing Supabase config:', { url: !!SUPABASE_URL, key: !!SUPABASE_SERVICE_KEY });
    return NextResponse.json({ error: 'Supabase not configured', profiles: [] }, { status: 500 });
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', PROFILE_SELECT);
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '1000');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey:        SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[/api/profiles] Supabase error:', res.status, err);
      return NextResponse.json({ error: err, profiles: [] }, { status: 500 });
    }

    const profiles = await res.json();
    return NextResponse.json({ profiles: Array.isArray(profiles) ? profiles : [] });
  } catch (e) {
    console.error('[/api/profiles] Exception:', e);
    return NextResponse.json({ error: String(e), profiles: [] }, { status: 500 });
  }
}
