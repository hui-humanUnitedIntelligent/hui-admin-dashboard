// frontend/src/app/lib/rate-limit.ts
// ── Lightweight in-memory Rate Limiter für SADB API Routes ─────────────────
// Da SADB auf Vercel Serverless läuft, ist dieser Limiter PER-INSTANCE.
// Das ist nicht perfekt für Multi-Instance, aber ausreichend für:
// - Brute-Force-Schutz auf Login-Route
// - Basic Abuse Prevention auf Admin-APIs
// - Volumetric Protection gegen einfache Flooding-Angriffe
//
// Für echte Multi-Instance Rate Limits wäre Vercel KV/Edge Config nötig.
// Das ist ein Defense-in-Depth-Minimum, kein Enterprise-Grade-Setup.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Map: key (ip + route) → entry
const store = new Map<string, RateLimitEntry>();

// Cleanup: Entferne abgelaufene Einträge (probabilistisch, 5% pro Request)
function cleanup() {
  if (Math.random() < 0.05) {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  ip: string,
  route: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): RateLimitResult {
  cleanup();

  const key = `${ip}:${route}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // Neues Fenster starten
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// ── Hilfsfunktion: IP aus Request extrahieren ─────────────────────────────
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP.trim();
  return 'unknown';
}

// ── Hilfsfunktion: Rate-Limit-Response erzeugen ────────────────────────────
import { NextResponse } from 'next/server';

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { ok: false, error: 'Rate limit exceeded. Retry later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfter)),
        'Cache-Control': 'no-store',
      },
    }
  );
}

// ── Presets ──────────────────────────────────────────────────────────────
export const RATE_LIMITS = {
  // Auth-Routen: 10 Versuche pro Minute (Brute-Force-Schutz)
  AUTH: { maxRequests: 10, windowMs: 60_000 },
  // Standard Admin-API: 60 pro Minute
  API: { maxRequests: 60, windowMs: 60_000 },
  // Schreibende Operationen (POST/PATCH/DELETE): 20 pro Minute
  WRITE: { maxRequests: 20, windowMs: 60_000 },
  // Export/Download: 5 pro Minute
  EXPORT: { maxRequests: 5, windowMs: 60_000 },
} as const;
