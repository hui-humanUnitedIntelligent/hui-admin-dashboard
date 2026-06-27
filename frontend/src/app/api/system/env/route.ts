// frontend/src/app/api/system/env/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_URL',
];

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const vars = ENV_KEYS.map(key => ({
    key,
    value: process.env[key]
      ? (process.env[key]!.startsWith('https://') ? process.env[key]! : 'SET')
      : 'FEHLT',
  }));

  return NextResponse.json({ data: vars });
}
