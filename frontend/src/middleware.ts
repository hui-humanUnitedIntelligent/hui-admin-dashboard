// frontend/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getClientIP, rateLimitResponse, RATE_LIMITS } from '@/app/lib/rate-limit';
import { needsRefresh, refreshSession } from '@/app/lib/session-refresh';

// Pfade die NUR superadmin darf (kein /employee prefix!)
const SUPERADMIN_PATHS = [
  '/works', '/dashboard', '/employees', '/users', '/impact', '/transactions',
  '/admins', '/ambassadors', '/analytics', '/audit', '/bookings',
  '/broadcast', '/churns', '/exports', '/experiences', '/flags',
  '/impact-projekte', '/memberships', '/reports', '/reviews',
  '/score-failures', '/settings', '/system', '/talents', '/tickets',
];

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage — identisch zu mfa/verify

// ── SESSION-REFRESH-FIX (2026-08-26) ──────────────────────────────────────
// Root Cause "alles leer in der App" (401 auf jeder API-Route nach ~1h):
// Commit 462c114 verifiziert den access_token seit heute ECHT gegen Supabase
// (auth-guard.ts → getUser()), statt nur die Cookie-Existenz zu prüfen. Der
// access_token läuft nach 3600s ab — ohne Refresh-Mechanismus war die Session
// ab Stunde 1 tot, obwohl der Cookie noch 7 Tage gültig aussah.
// Fix: HIER, vor jeder Weiterleitung (Seiten UND API), prüfen ob der Token
// bald abläuft; falls ja, per refresh_token erneuern, neue Cookies auf die
// Response schreiben UND die Request-Cookies für nachgelagerte Route-Handler
// aktualisieren (Next.js-Standardmuster für Middleware-Session-Refresh).
async function applyRefresh(req: NextRequest): Promise<{ response: NextResponse; token: string | undefined; loggedOut: boolean }> {
  const token = req.cookies.get('hui_admin_token')?.value;
  const refreshToken = req.cookies.get('hui_admin_refresh')?.value;

  if (!token) {
    return { response: NextResponse.next(), token: undefined, loggedOut: false };
  }

  if (!needsRefresh(token)) {
    return { response: NextResponse.next(), token, loggedOut: false };
  }

  if (!refreshToken) {
    // Kein Refresh-Token vorhanden (z.B. Session von vor diesem Fix) — Token läuft
    // ab/ist abgelaufen und kann nicht erneuert werden. Cookies löschen, damit die
    // bestehende "kein Token" Logik (Login-Redirect / 401) greift, statt in einer
    // Zombie-Session mit garantiert scheiterndem getUser()-Call zu verharren.
    const res = NextResponse.next();
    res.cookies.set('hui_admin_token', '', { path: '/', maxAge: 0 });
    res.cookies.set('hui_admin_role', '', { path: '/', maxAge: 0 });
    return { response: res, token: undefined, loggedOut: true };
  }

  const result = await refreshSession(refreshToken);

  if (result.invalid) {
    // refresh_token selbst ungültig/abgelaufen/verbraucht → Session endgültig tot.
    const res = NextResponse.next();
    res.cookies.set('hui_admin_token', '', { path: '/', maxAge: 0 });
    res.cookies.set('hui_admin_role', '', { path: '/', maxAge: 0 });
    res.cookies.set('hui_admin_refresh', '', { path: '/', maxAge: 0 });
    return { response: res, token: undefined, loggedOut: true };
  }

  if (!result.refreshed || !result.access_token || !result.refresh_token) {
    // Netzwerk-Hiccup o.ä. — alten (evtl. noch kurz gültigen) Token weiterverwenden,
    // auth-guard.ts entscheidet in der Route final via getUser().
    return { response: NextResponse.next(), token, loggedOut: false };
  }

  // Erfolgreich erneuert: Request-Cookies ZUERST mutieren (RequestCookies.set()
  // schreibt direkt in req.headers' Cookie-Header — Reihenfolge ist entscheidend:
  // erst mutieren, DANN eine Kopie der (jetzt aktuellen) Headers für NextResponse.next()
  // ziehen. So sieht der nachgelagerte Route-Handler sofort den frischen Token, ohne
  // dass der Browser erst einen weiteren Request schicken muss.
  req.cookies.set('hui_admin_token', result.access_token);
  req.cookies.set('hui_admin_refresh', result.refresh_token);
  const requestHeaders = new Headers(req.headers);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const cookieBase = { secure: true, sameSite: 'lax' as const, path: '/', maxAge: SESSION_COOKIE_MAX_AGE, httpOnly: true };
  response.cookies.set('hui_admin_token', result.access_token, cookieBase);
  response.cookies.set('hui_admin_refresh', result.refresh_token, cookieBase);

  return { response, token: result.access_token, loggedOut: false };
}

export async function middleware(req: NextRequest) {
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

  // 0b) Public-Pfade (Login, Manifest, Icons) — kein Refresh-Versuch nötig,
  //     dort gibt es ohnehin (noch) keine Session.
  const isPublicPath =
    pathname === '/login' ||
    pathname === '/login/mfa-enroll' ||
    pathname === '/login/mfa-challenge' ||
    pathname === '/manifest.json' ||
    pathname === '/sw-push.js' ||
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png' ||
    pathname.startsWith('/api/auth/');

  // 1) Session-Refresh — für JEDEN nicht-öffentlichen Request (Seiten + API),
  //    BEVOR Rate-Limiting/Routing-Entscheidungen getroffen werden.
  let refreshResponse: NextResponse | null = null;
  if (!isPublicPath) {
    const { response, loggedOut } = await applyRefresh(req);
    refreshResponse = response;
    if (loggedOut) {
      // Session tot — für API sofort 401 (guardAdmin würde das eh liefern, aber
      // ohne unnötigen Supabase-Roundtrip), für Seiten weiter zur Login-Redirect-Logik
      // unten (die greift automatisch, weil der Token-Cookie jetzt geleert ist).
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, error: 'Session expired' }, { status: 401 });
      }
    }
  }

  // 2) API-Routen — Rate Limiting (vor Public-Check!)
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

    return refreshResponse ?? NextResponse.next();
  }

  // 3) Public — immer erlauben (non-API)
  if (isPublicPath) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hui_admin_token')?.value;
  const role  = req.cookies.get('hui_admin_role')?.value ?? '';

  // 4) Kein Token → Login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 5) Employee-Bereiche — zuerst prüfen (vor SUPERADMIN_PATHS!)
  //    Sowohl 'employee' als auch 'superadmin' dürfen /employee/*
  if (pathname.startsWith('/employee')) {
    if (role !== 'employee' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return refreshResponse ?? NextResponse.next();
  }

  // 6) Superadmin-Bereiche — nur superadmin
  const isSuperAdminPath = SUPERADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isSuperAdminPath) {
    if (role !== 'superadmin') {
      // Employee → weiterleiten zu /employee/dashboard
      return NextResponse.redirect(new URL('/employee/dashboard', req.url));
    }
  }

  return refreshResponse ?? NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
