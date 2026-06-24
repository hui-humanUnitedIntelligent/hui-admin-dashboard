// frontend/src/lib/supabase.ts
// ── HUI Admin — Supabase Client (singleton) ───────────────────────────────
// Einzige Stelle wo der Supabase Client instanziiert wird.
// SICHERHEIT: Der Service Role Key wird NICHT im Client verwendet.
//             Admin-Mutations laufen ausschließlich über /api/* Server Routes.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── Anon Client (Queries + Realtime-Subscriptions) ────────────────────────
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth:     { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

export default supabase;
