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

  if (action === "execute_payout") {
    const admin = await getAuthUser(req);
    if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { payout_id } = body;

    const { data: payout } = await sb.from("stripe_payouts").select("*").eq("id", payout_id).single();
    if (!payout) return NextResponse.json({ ok: false, error: "payout_not_found" }, { status: 404 });
    if (payout.status !== "approved") {
      return NextResponse.json({ ok: false, error: "invalid_state", current_status: payout.status }, { status: 400 });
    }

    const { data: ambProfile } = await sb
      .from("profiles").select("stripe_account_id, stripe_connect_status")
      .eq("id", payout.ambassador_id).single();
    if (!ambProfile?.stripe_account_id) {
      return NextResponse.json({ ok: false, error: "ambassador_not_connected" }, { status: 400 });
    }

    try {
      const transfer = await stripeRequest("/transfers", {
        amount: payout.amount, // bereits in Cent
        currency: payout.currency || "eur",
        destination: ambProfile.stripe_account_id,
        "metadata[payout_id]": payout_id,
        "metadata[ambassador_id]": payout.ambassador_id,
        "metadata[source]": "hui_ambassador_payout_admin",
      });

      await sb.from("stripe_payouts").update({
        status: "paid",
        stripe_payout_id: transfer.id,
        processed_at: new Date().toISOString(),
      }).eq("id", payout_id);

      await sb.rpc("rpc_mark_commissions_paid", { p_payout_id: payout_id });

      if (ambProfile.stripe_connect_status !== "connected") {
        await sb.from("profiles").update({ stripe_connect_status: "connected" }).eq("id", payout.ambassador_id);
      }

      return NextResponse.json({ ok: true, payout_id, stripe_transfer_id: transfer.id, status: "paid" });
    } catch (err: any) {
      await sb.rpc("rpc_fail_payout", {
        p_payout_id: payout_id,
        p_reason: (err?.message || "stripe_transfer_failed").slice(0, 500),
      });
      return NextResponse.json({ ok: false, error: err?.message }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
