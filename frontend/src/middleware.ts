// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getClientIP, rateLimitResponse, RATE_LIMITS } from '@/app/lib/rate-limit';

// Pfade die NUR superadmin darf (kein /employee prefix!)
const SUPERADMIN_PATHS = [
  '/works', '/dashboard', '/employees', '/users', '/impact', '/transactions',
  '/admins', '/ambassadors', '/analytics', '/audit', '/bookings',
  '/broadcast', '/churns', '/exports', '/experiences', '/flags',
  '/impact-projekte', '/memberships', '/reports', '/reviews',
  '/score-failures', '/settings', '/system', '/talents', '/tickets',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0) Alte vercel.app-Domain -> permanent auf die neue Domain umleiten
  //    (Pfad + Query bleiben erhalten). Custom Domain ist die kanonische Adresse.
  const host = req.headers.get('host') || '';
  if (host.endsWith('.vercel.app')) {
    const url = req.nextUrl.clone();
    url.protocol = 'https';
    url.host = 'www.hui-admin.com';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  // 1) API-Routen — Rate Limiting (vor Public-Check!)
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(req);

    // Login/MFA-Routen: Brute-Force-Schutz (10/min)
    if (pathname.startsWith('/api/auth/admin-login') || pathname.startsWith('/api/auth/mfa/')) {
      const result = rateLimit(ip, 'auth-login', RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs);
      if (!result.allowed) return rateLimitResponse(result.resetAt);
    }
    // Export: sehr streng (5/min)
    else if (pathname.startsWith('/api/export')) {
      const result = rateLimit(ip, 'export', RATE_LIMITS.EXPORT.maxRequests, RATE_LIMITS.EXPORT.windowMs);
      if (!result.allowed) return rateLimitResponse(result.resetAt);
    }
    // Schreibende Operationen: moderat (20/min)
    else if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE') {
      const result = rateLimit(ip, 'write', RATE_LIMITS.WRITE.maxRequests, RATE_LIMITS.WRITE.windowMs);
      if (!result.allowed) return rateLimitResponse(result.resetAt);
    }
    // Standard GET: 60/min
    else {
      const result = rateLimit(ip, 'api-get', RATE_LIMITS.API.maxRequests, RATE_LIMITS.API.windowMs);
      if (!result.allowed) return rateLimitResponse(result.resetAt);
    }

    return NextResponse.next();
  }

  // 2) Public — immer erlauben (non-API)
  if (
    pathname === '/login' ||
    pathname === '/login/mfa-enroll' ||
    pathname === '/login/mfa-challenge' ||
    pathname === '/manifest.json' ||
    pathname === '/sw-push.js' ||
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png'
  ) {
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
