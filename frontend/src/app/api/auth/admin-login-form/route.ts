// frontend/src/app/api/auth/admin-login-form/route.ts
// POST /api/auth/admin-login-form — Form-basierter Login mit Cookie + 303 Redirect
// 303 See Other: erzwingt GET beim Redirect — verhindert POST /works (405)
import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const MAX_AGE = 60 * 60 * 8;

function redirect303(url: URL, req: NextRequest) {
  // 303 statt 307 — Browser macht GET beim Folge-Request
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: url.toString() },
  });
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData();
    const email     = formData.get('email')     as string;
    const password  = formData.get('password')  as string;
    const dashboard = formData.get('dashboard') as string;

    if (!email || !password) {
      return redirect303(new URL('/login?error=missing', req.url), req);
    }

    // 1) Supabase Login
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.access_token) {
      return redirect303(new URL('/login?error=credentials', req.url), req);
    }

    const access_token = data.session.access_token;
    const user         = data.user;

    // 2) Rolle bestimmen
    let finalRole = normalizeRole(
      user.app_metadata?.role || user.user_metadata?.role || 'employee'
    );
    try {
      const sb = getServiceClient();
      const { data: profile } = await sb
        .from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role) finalRole = normalizeRole(profile.role);
    } catch { /* Fallback */ }

    // 3) Zugriffsprüfung
    if (dashboard === 'admin' && finalRole !== 'superadmin') {
      return redirect303(new URL('/login?error=forbidden', req.url), req);
    }

    // 4) Ziel-URL
    const dest = dashboard === 'employee' ? '/employee/works' : '/works';

    // 5) 303 + Cookie — Browser macht GET /works mit gesetztem Cookie
    const res = new NextResponse(null, {
      status: 303,
      headers: { Location: new URL(dest, req.url).toString() },
    });

    res.cookies.set('hui_admin_token', access_token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
    });
    res.cookies.set('hui_admin_role', finalRole, {
      httpOnly: false,
      secure:   true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
    });

    return res;
  } catch (err) {
    console.error('[admin-login-form]', err);
    return redirect303(new URL('/login?error=server', req.url), req);
  }
}
