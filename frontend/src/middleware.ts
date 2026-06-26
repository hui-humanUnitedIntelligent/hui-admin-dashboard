// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Pfade die NUR superadmin darf (kein /employee prefix!)
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
  const role  = req.cookies.get('hui_admin_role')?.value ?? '';

  // 2) Kein Token → Login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3) Employee-Bereiche — zuerst prüfen (vor SUPERADMIN_PATHS!)
  //    Sowohl 'employee' als auch 'superadmin' dürfen /employee/*
  if (pathname.startsWith('/employee')) {
    if (role !== 'employee' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // 4) Superadmin-Bereiche — nur superadmin
  const isSuperAdminPath = SUPERADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isSuperAdminPath) {
    if (role !== 'superadmin') {
      // Employee → weiterleiten zu /employee/dashboard
      return NextResponse.redirect(new URL('/employee/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
