// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Alle Superadmin-Routen (flach unter /)
const SUPERADMIN_PATHS = [
  '/works',
  '/dashboard',
  '/users',
  '/impact',
  '/transactions',
  '/admins',
  '/ambassadors',
  '/analytics',
  '/audit',
  '/bookings',
  '/broadcast',
  '/churns',
  '/exports',
  '/experiences',
  '/flags',
  '/impact-projekte',
  '/memberships',
  '/reports',
  '/reviews',
  '/score-failures',
  '/settings',
  '/system',
  '/talents',
  '/tickets',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Öffentliche Routen — immer erlauben
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hui_admin_token')?.value;
  const role  = req.cookies.get('hui_admin_role')?.value;

  // 2) Kein Token → Login
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3) Superadmin-Bereiche
  if (SUPERADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/employee/works', req.url));
    }
  }

  // 4) Employee-Bereiche
  if (pathname.startsWith('/employee')) {
    if (role !== 'employee' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // _next/static, _next/image, favicon, und _next/data (RSC) ausschließen
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
