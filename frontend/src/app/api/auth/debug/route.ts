// frontend/src/app/api/auth/debug/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();

  return NextResponse.json({
    token: cookieStore.get('hui_admin_token')?.value || null,
    role:  cookieStore.get('hui_admin_role')?.value || null,
  });
}
