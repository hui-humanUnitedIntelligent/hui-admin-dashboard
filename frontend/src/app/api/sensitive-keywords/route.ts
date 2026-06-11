// frontend/src/app/api/sensitive-keywords/route.ts
// Lädt Keywords aus Supabase sensitive_keywords Tabelle
import { NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface SensitiveKeyword {
  id:       string;
  category: string;
  keyword:  string;
  language: string;
  severity: 1 | 2 | 3;
}

// Einfaches In-Memory-Cache für die Laufzeit (kein Dauerstate nötig)
let _cache: SensitiveKeyword[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

export async function GET() {
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  // Cache nutzen wenn frisch genug
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return NextResponse.json(_cache);
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/sensitive_keywords`);
    url.searchParams.set('select', 'id,category,keyword,language,severity');
    url.searchParams.set('order', 'severity.desc,category.asc');
    url.searchParams.set('limit', '500');

    const res = await fetch(url.toString(), {
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[api/sensitive-keywords] Supabase error:', res.status);
      return NextResponse.json([], { status: 200 }); // Graceful fallback
    }

    const data = await res.json() as SensitiveKeyword[];
    _cache = data;
    _cacheTime = Date.now();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/sensitive-keywords] fetch error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
