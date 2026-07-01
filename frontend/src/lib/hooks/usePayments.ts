// frontend/src/lib/hooks/usePayments.ts
// Konsolidiert (ARCH-006.1): keine zweite Wahrheit — verwendet exklusiv
// die kanonische Implementierung aus useSupabase.ts (RPC-basiert, echte
// Stripe-Daten aus allen 5 stripe_* Tabellen).
'use client';
export { usePayments, type HuiPayment, type HuiTransaction } from './useSupabase';
