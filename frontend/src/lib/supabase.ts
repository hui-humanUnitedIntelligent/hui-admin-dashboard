// frontend/src/lib/supabase.ts
// ── HUI Admin — Supabase Client (singleton) ───────────────────────────────
// Einzige Stelle wo der Supabase Client instanziiert wird.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SVC  = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// ── Anon Client (Queries + Realtime-Subscriptions) ────────────────────────
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth:     { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Service-Role Client (Admin-Mutations, nur server-side via API routes) ──
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SVC || SUPABASE_ANON,
  { auth: { persistSession: false } }
);

export default supabase;
