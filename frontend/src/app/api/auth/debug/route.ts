// frontend/src/app/api/auth/debug/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('hui_admin_token')?.value;
  const role  = req.cookies.get('hui_admin_role')?.value;

  // Alle Cookies anzeigen
  const allCookies: Record<string, string> = {};
  req.cookies.getAll().forEach(c => {
    allCookies[c.name] = c.name.includes('token') ? c.value.substring(0, 20) + '...' : c.value;
  });

  const superadminPaths = ['/works', '/dashboard', '/users'];
  const wouldRedirect = !token ? '/login (no token)'
    : role !== 'superadmin' ? `/employee/works (role=${role})`
    : 'PASS (superadmin ok)';

  return NextResponse.json({
    has_token:    !!token,
    role:         role ?? null,
    would_allow:  wouldRedirect,
    all_cookies:  allCookies,
    cookie_count: Object.keys(allCookies).length,
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
