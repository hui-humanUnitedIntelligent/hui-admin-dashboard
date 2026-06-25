// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: Login + ALLE Auth-API-Routen (egal ob Query, RSC, Next.js intern)
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hui_admin_token')?.value;
  const role  = req.cookies.get('hui_admin_role')?.value;

  // Kein Token → redirect login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // SUPERADMIN-BEREICHE
  if (pathname.startsWith('/works') || pathname.startsWith('/dashboard')) {
    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/employee/works', req.url));
    }
  }

  // EMPLOYEE-BEREICHE
  if (pathname.startsWith('/employee')) {
    if (role !== 'employee' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
