// frontend/src/app/api/auth/check/route.ts
// GET /api/auth/check?dest=/works — prüft Cookie, redirectet zu dest oder /login
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const dest  = req.nextUrl.searchParams.get('dest') || '/works';
  const token = req.cookies.get('hui_admin_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=nocookie', req.url));
  }

  return NextResponse.redirect(new URL(dest, req.url));
}
