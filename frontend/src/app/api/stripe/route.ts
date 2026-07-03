// frontend/src/app/api/stripe/route.ts
// HUI Stripe API — Create Customer, Payment Intent, Subscription
import { NextRequest, NextResponse } from "next/server";
import { guardEmployee, getAuthUser } from "@/app/lib/auth-guard";
import { getServiceClient } from "@/app/lib/supabase-server";

const STRIPE_SK = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_BASE = "https://api.stripe.com/v1";

async function stripeRequest(path: string, params: Record<string, any> = {}, method = "POST") {
  const body = method !== "GET"
    ? Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : undefined;
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SK}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`);
  return data;
}

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "overview";
  const sb   = getServiceClient();

  if (type === "overview") {
    const { data: overview } = await sb.rpc("rpc_get_stripe_overview");
    const { count: paymentsCount } = await sb
      .from("stripe_payments").select("*", { count: "exact", head: true });
    return NextResponse.json({ ok: true, data: overview, total_payments: paymentsCount ?? 0 });
  }

  if (type === "payments") {
    const limit  = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const { data } = await sb.rpc("rpc_get_stripe_payments", { p_limit: limit, p_offset: offset });
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "subscriptions") {
    const { data } = await sb
      .from("stripe_subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "payouts") {
    // AMB-PAYOUT-009: rpc_get_payout_requests statt Rohabfrage -- liefert
    // username/display_name/email/commission_count korrekt gejoint (vorher: undefined)
    const statusFilter = searchParams.get("status");
    const limit  = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const { data, error } = await sb.rpc("rpc_get_payout_requests", {
      p_status: statusFilter && statusFilter !== "all" ? statusFilter : null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "commissions") {
    const ambassadorId = searchParams.get("ambassador_id");
    let query = sb.from("stripe_ambassador_commissions")
      .select("*, ambassador:profiles!ambassador_id(username,display_name,email)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (ambassadorId) query = query.eq("ambassador_id", ambassadorId);
    const { data } = await query;
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "webhooks") {
    const { data } = await sb
      .from("stripe_webhooks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "impact_pool") {
    const { data } = await sb
      .from("stripe_impact_pool")
      .select("*")
      .order("month", { ascending: false })
      .limit(24);
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "impact_pool_current") {
    const { data } = await sb.rpc("rpc_get_impact_pool_current");
    return NextResponse.json({ ok: true, data: data ?? {} });
  }

  if (type === "impact_pool_history") {
    const limit = parseInt(searchParams.get("limit") || "12");
    const { data } = await sb.rpc("rpc_get_impact_pool_history", { p_limit: limit });
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  if (type === "impact_pool_events") {
    const month  = searchParams.get("month") || undefined;
    const limit  = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const { data } = await sb.rpc("rpc_get_impact_pool_events", {
      p_month: month ?? null, p_limit: limit, p_offset: offset,
    });
    return NextResponse.json({ ok: true, data: data ?? [] });
  }

  return NextResponse.json({ ok: false, error: "Unknown type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const action = body.action;
  const sb     = getServiceClient();

  if (action === "create_customer") {
    const { user_id, email, name } = body;
    const existing = await sb.from("stripe_customers").select("stripe_customer_id").eq("user_id", user_id).single();
    if (existing.data?.stripe_customer_id) {
      return NextResponse.json({ ok: true, customer_id: existing.data.stripe_customer_id });
    }
    const customer = await stripeRequest("/customers", { email, name, metadata: `user_id=${user_id}` });
    await sb.from("stripe_customers").upsert({ user_id, stripe_customer_id: customer.id, email, name }, { onConflict: "user_id" });
    return NextResponse.json({ ok: true, customer_id: customer.id });
  }

  if (action === "create_payment_intent") {
    const { amount, currency = "eur", customer_id, metadata = {} } = body;
    const intent = await stripeRequest("/payment_intents", {
      amount: Math.round(amount * 100),
      currency,
      customer: customer_id,
      automatic_payment_methods: "enabled",
      ...Object.fromEntries(Object.entries(metadata).map(([k,v]) => [`metadata[${k}]`, v])),
    });
    return NextResponse.json({ ok: true, client_secret: intent.client_secret, intent_id: intent.id });
  }

  if (action === "create_checkout_session") {
    const { price_id, customer_id, success_url, cancel_url, mode = "payment", metadata = {} } = body;
    const params: Record<string, any> = {
      mode,
      "line_items[0][price]":    price_id,
      "line_items[0][quantity]": 1,
      success_url: success_url || "https://be-hui.com/success",
      cancel_url:  cancel_url  || "https://be-hui.com/cancel",
    };
    if (customer_id) params.customer = customer_id;
    Object.entries(metadata).forEach(([k,v]) => { params[`metadata[${k}]`] = v; });
    const session = await stripeRequest("/checkout/sessions", params);
    return NextResponse.json({ ok: true, url: session.url, session_id: session.id });
  }

  // ── AMB-PAYOUT-009: Ambassador-Auszahlungsanfragen verwalten ────────────
  if (action === "approve_payout") {
    const admin = await getAuthUser(req);
    if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { payout_id } = body;
    const { data, error } = await sb.rpc("rpc_approve_payout", {
      p_payout_id: payout_id, p_admin_id: admin.id,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "reject_payout") {
    const admin = await getAuthUser(req);
    if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { payout_id, reason } = body;
    const { data, error } = await sb.rpc("rpc_reject_payout", {
      p_payout_id: payout_id, p_admin_id: admin.id, p_reason: reason || null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // AMB-PAYOUT-016: konsolidiert -- ruft jetzt die eine autoritative Edge Function
  // (ambassador-payout-execute) statt den Stripe-Transfer hier ein zweites Mal zu
  // implementieren (siehe #482/#-Fund: doppelte Transfer-Logik). Der Admin ist bereits
  // durch getAuthUser()/dieses Dashboard verifiziert -- die Edge Function akzeptiert
  // deshalb den Service-Role-Key + explizites admin_id als vertrauenswuerdigen Server-Call.
  if (action === "execute_payout") {
    const admin = await getAuthUser(req);
    if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { payout_id } = body;

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ambassador-payout-execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ payout_id, admin_id: admin.id }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        return NextResponse.json({ ok: false, error: data?.error || "execute_failed" }, { status: res.status });
      }
      return NextResponse.json(data);
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || "network_error" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
