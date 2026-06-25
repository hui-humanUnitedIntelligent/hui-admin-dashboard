// frontend/src/middleware.ts
// Schützt alle Admin-Routen via hui_admin_token Cookie.
// Login-Seite und Auth-API sind öffentlich.
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/admin-login',
  '/api/auth/admin-logout',
  '/_next',
  '/favicon',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Öffentliche Routen durchlassen
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Token aus Cookie lesen
  const token = req.cookies.get('hui_admin_token')?.value;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Alle Routen außer:
     * - _next/static
     * - _next/image
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
