// frontend/src/app/api/stripe/webhook/route.ts
// HUI Stripe Webhook Handler — ARCH-006.1
// Alle Stripe Events → Supabase synchronisieren
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/app/lib/supabase-server";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY     || "";

export const dynamic = "force-dynamic";

async function verifyStripeSignature(body: string, signature: string): Promise<boolean> {
  const parts = signature.split(",");
  const t     = parts.find(p => p.startsWith("t="))?.split("=")[1];
  if (!t) return false;
  const signed = parts.filter(p => p.startsWith("v1=")).map(p => p.split("=")[1]);
  const payload = `${t}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,"0")).join("");
  return signed.includes(hex);
}

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  const sb        = getServiceClient();

  // Signatur prüfen
  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(body, signature);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(body); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const eventId   = event.id;
  const eventType = event.type;
  const data      = event.data?.object ?? {};

  // Webhook loggen
  await sb.from("stripe_webhooks").upsert({
    stripe_event_id: eventId,
    event_type:      eventType,
    payload:         event,
    status:          "processing",
  }, { onConflict: "stripe_event_id" }).select();

  try {
    switch (eventType) {

      case "payment_intent.succeeded": {
        const customerId = data.customer;
        const amount     = data.amount_received || data.amount;
        const currency   = data.currency || "eur";
        const meta       = data.metadata || {};
        const paymentType = meta.payment_type || "one_time";

        // User via customer_id ermitteln
        let userId: string | null = null;
        if (customerId) {
          const { data: cust } = await sb
            .from("stripe_customers")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();
          userId = cust?.user_id || null;
        }

        // Pool + Ambassador berechnen
        const poolShare = Math.floor(amount * 0.15);
        const ambShare  = 0; // wird in rpc_record_payment berechnet

        // Zahlung speichern
        await sb.from("stripe_payments").upsert({
          stripe_payment_id:   data.id,
          stripe_customer_id:  customerId,
          user_id:             userId,
          amount,
          currency,
          status:              "succeeded",
          payment_type:        paymentType,
          description:         data.description,
          metadata:            meta,
          impact_pool_share:   poolShare,
          stripe_event_id:     eventId,
        }, { onConflict: "stripe_payment_id" });

        // Impact Pool updaten
        const month = new Date().toISOString().slice(0, 7);
        await sb.from("stripe_impact_pool").upsert({
          month,
          total_inflow:  amount,
          project_share: poolShare,
          company_share: amount - poolShare,
        }, { onConflict: "month" });

        // first_transaction_at setzen
        if (userId) {
          await sb.from("profiles")
            .update({ first_transaction_at: new Date().toISOString() })
            .eq("id", userId)
            .is("first_transaction_at", null);

          // Ambassador-Provision
          const { data: prof } = await sb
            .from("profiles")
            .select("referred_by")
            .eq("id", userId)
            .single();

          if (prof?.referred_by) {
            const ambCommission = Math.floor(amount * 0.05);
            await sb.from("stripe_ambassador_commissions").insert({
              ambassador_id:     prof.referred_by,
              referred_user_id:  userId,
              stripe_payment_id: data.id,
              amount:            ambCommission,
              currency,
              status:            "pending",
            });
            // Ambassador-Share in payment speichern
            await sb.from("stripe_payments")
              .update({ ambassador_id: prof.referred_by, ambassador_share: ambCommission })
              .eq("stripe_payment_id", data.id);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        await sb.from("stripe_payments").upsert({
          stripe_payment_id:  data.id,
          stripe_customer_id: data.customer,
          amount:             data.amount || 0,
          currency:           data.currency || "eur",
          status:             "failed",
          stripe_event_id:    eventId,
        }, { onConflict: "stripe_payment_id" });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const { data: cust } = await sb
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", data.customer)
          .single();

        await sb.from("stripe_subscriptions").upsert({
          stripe_subscription_id: data.id,
          stripe_customer_id:     data.customer,
          user_id:                cust?.user_id,
          stripe_price_id:        data.items?.data?.[0]?.price?.id,
          status:                 data.status,
          amount:                 data.items?.data?.[0]?.price?.unit_amount || 0,
          currency:               data.items?.data?.[0]?.price?.currency || "eur",
          current_period_start:   new Date(data.current_period_start * 1000).toISOString(),
          current_period_end:     new Date(data.current_period_end   * 1000).toISOString(),
          cancel_at_period_end:   data.cancel_at_period_end,
        }, { onConflict: "stripe_subscription_id" });
        break;
      }

      case "customer.subscription.deleted": {
        await sb.from("stripe_subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", data.id);
        break;
      }

      case "payout.paid": {
        await sb.from("stripe_payouts").upsert({
          stripe_payout_id: data.id,
          amount:           data.amount,
          currency:         data.currency,
          status:           "paid",
          arrival_date:     new Date(data.arrival_date * 1000).toISOString(),
          description:      data.description,
        }, { onConflict: "stripe_payout_id" });
        break;
      }

      case "payout.failed": {
        await sb.from("stripe_payouts").upsert({
          stripe_payout_id: data.id,
          amount:           data.amount || 0,
          currency:         data.currency || "eur",
          status:           "failed",
        }, { onConflict: "stripe_payout_id" });
        break;
      }

      case "charge.refunded": {
        await sb.from("stripe_payments")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_id", data.payment_intent);
        break;
      }
    }

    // Webhook als processed markieren
    await sb.from("stripe_webhooks")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", eventId);

    return NextResponse.json({ received: true, event_type: eventType });

  } catch (err) {
    await sb.from("stripe_webhooks")
      .update({ status: "failed", error_message: String(err) })
      .eq("stripe_event_id", eventId);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
