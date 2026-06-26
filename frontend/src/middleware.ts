// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPERADMIN_PATHS = [
  '/works', '/dashboard', '/users', '/impact', '/transactions',
  '/admins', '/ambassadors', '/analytics', '/audit', '/bookings',
  '/broadcast', '/churns', '/exports', '/experiences', '/flags',
  '/impact-projekte', '/memberships', '/reports', '/reviews',
  '/score-failures', '/settings', '/system', '/talents', '/tickets',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Public — immer erlauben
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hui_admin_token')?.value;
  const role  = req.cookies.get('hui_admin_role')?.value;

  // 2) Kein Token → Login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
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
  // Nur echte Page-Routen matchen — _next/* und statische Dateien komplett ausschließen
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
