// frontend/src/app/api/profiles/route.ts
// Server-side profiles query — SUPABASE_SERVICE_ROLE_KEY nie im Browser
import { NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

const SELECT = [
  'id,display_name,username,avatar_url,bio,tagline,role,membership_type',
  'is_wirker,is_member,membership_active,has_talent_profile,talent',
  'location,location_label,is_available,availability,impact_eur',
  'follower_count,followers_count,trust_score,is_guardian',
  'last_seen,last_seen_at,created_at,updated_at,skills,focus_type',
  'email,phone,full_name,is_talent,talent_since,talent_activated_at',
  'member_since,blocked,blocked_at,blocked_by,is_blocked,is_deleted,username_lower',
].join(',');

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ profiles: [], error: 'Supabase not configured' }, { status: 500 });
  }
  const url = `${SUPABASE_URL}/rest/v1/profiles?select=${encodeURIComponent(SELECT)}&order=created_at.desc&limit=1000`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ profiles: [], error: await res.text() }, { status: 500 });
    const profiles = await res.json();
    return NextResponse.json({ profiles: Array.isArray(profiles) ? profiles : [] });
  } catch (e) {
    return NextResponse.json({ profiles: [], error: String(e) }, { status: 500 });
  }
}
