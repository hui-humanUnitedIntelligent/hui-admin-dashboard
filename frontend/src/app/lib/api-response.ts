// frontend/src/app/lib/api-response.ts
// ── Zentrales API Response-Schema für alle Admin-Routes ──────────────────────
// Einheitliche Formate: success / fail / validationError / serverError
// Importiert in alle /app/api/**/*.ts

import { NextResponse } from 'next/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  ok:   true;
  data: T;
}

export interface ApiFail {
  ok:      false;
  error:   string;
  code?:   string;
  fields?: Record<string, string>;
}

// ── Response-Helpers ──────────────────────────────────────────────────────────

/** 200 OK — mit Daten */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data } satisfies ApiSuccess<T>, { status });
}

/** 201 Created */
export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

/** 400 Bad Request — allgemeiner Fehler */
export function fail(message: string, status = 400, code?: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, code } satisfies ApiFail,
    { status }
  );
}

/** 400 Validation Error — Felder-spezifisch */
export function validationError(fields: Record<string, string>, message = 'Validierungsfehler'): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, fields } satisfies ApiFail,
    { status: 400 }
  );
}

/** 401 Unauthorized */
export function unauthorized(message = 'Nicht autorisiert'): NextResponse {
  return fail(message, 401, 'UNAUTHORIZED');
}

/** 403 Forbidden */
export function forbidden(message = 'Zugriff verweigert'): NextResponse {
  return fail(message, 403, 'FORBIDDEN');
}

/** 404 Not Found */
export function notFound(resource = 'Ressource'): NextResponse {
  return fail(`${resource} nicht gefunden`, 404, 'NOT_FOUND');
}

/** 500 Server Error — loggt intern, gibt keine Details an den Client */
export function serverError(err: unknown, context = 'API'): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] Server Error:`, msg);
  return fail('Interner Serverfehler', 500, 'SERVER_ERROR');
}
