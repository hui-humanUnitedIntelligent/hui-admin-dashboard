// frontend/src/app/api/auth/admin-login-form/route.ts
// POST /api/auth/admin-login-form — Form-basierter Login mit Cookie + 302 Redirect
// Chrome-kompatibel: Cookie und Navigation passieren in EINEM HTTP-Response
import { NextRequest, NextResponse } from 'next/server';
import { getAnonClient, getServiceClient } from '@/app/lib/supabase-server';
import { normalizeRole } from '@/lib/roles';

const MAX_AGE = 60 * 60 * 8;

export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const email      = formData.get('email')     as string;
    const password   = formData.get('password')  as string;
    const dashboard  = formData.get('dashboard') as string;

    if (!email || !password) {
      return NextResponse.redirect(new URL('/login?error=missing', req.url));
    }

    // 1) Supabase Login
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.access_token) {
      return NextResponse.redirect(new URL('/login?error=credentials', req.url));
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
      return NextResponse.redirect(new URL('/login?error=forbidden', req.url));
    }

    // 4) Ziel-URL
    const dest = dashboard === 'employee' ? '/employee/works' : '/works';

    // 5) 302 Redirect MIT Cookie in EINEM Response — Chrome-kompatibel
    const response = NextResponse.redirect(new URL(dest, req.url));

    response.cookies.set('hui_admin_token', access_token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
    });
    response.cookies.set('hui_admin_role', finalRole, {
      httpOnly: false,
      secure:   true,
      sameSite: 'lax',
      path:     '/',
      maxAge:   MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error('[admin-login-form]', err);
    return NextResponse.redirect(new URL('/login?error=server', req.url));
  }
}
