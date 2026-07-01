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
        const meta        = data.metadata || {};
        const paymentType = meta.hui_payment_type || meta.payment_type || "work";
        const ambassadorId= meta.ambassador_id   || null;
        const pendingId   = meta.pending_id       || null;

        // ARCH-006.1: Alles in einem RPC → kein Shadow State, keine lokale Berechnung
        // rpc_record_payment: speichert Zahlung + aktualisiert Impact Pool (15%) + Ambassador (5%)
        await sb.rpc("rpc_record_payment", {
          p_stripe_payment_id:  data.id,
          p_stripe_customer_id: data.customer ?? "cus_unknown",
          p_amount:             data.amount_received || data.amount,
          p_currency:           data.currency ?? "eur",
          p_payment_type:       paymentType,
          p_ambassador_id:      ambassadorId,
          p_description:        data.description ?? null,
        });

        // ARCH-006.1 Punkt 7 (Buchungs-Detailansicht): falls diese Zahlung zu einer
        // Buchung gehoert (bookings.stripe_payment_id = data.id), Buchung live nachziehen
        // (status, payment_status, platform_fee, impact_fee, ambassador_commission).
        await sb.rpc("rpc_sync_booking_payment", { p_stripe_payment_id: data.id });

        // Pending Checkout bestätigen (falls vorhanden)
        if (pendingId) {
          await sb.rpc("rpc_confirm_checkout", {
            p_pending_id:        pendingId,
            p_stripe_payment_id: data.id,
          });
        }

        // first_transaction_at setzen (für Ambassador-Provisions-Startpunkt)
        // ARCH-006.1: rpc_record_payment hat bereits Pool + Provision berechnet.
        // Hier nur noch first_transaction_at nachziehen, falls User bekannt ist.
        if (data.customer) {
          const { data: cust } = await sb
            .from("stripe_customers")
            .select("user_id")
            .eq("stripe_customer_id", data.customer)
            .single();
          if (cust?.user_id) {
            await sb.from("profiles")
              .update({ first_transaction_at: new Date().toISOString() })
              .eq("id", cust.user_id)
              .is("first_transaction_at", null);
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

        // Buchung live nachziehen, falls verknuepft (ARCH-006.1 Punkt 7)
        await sb.rpc("rpc_sync_booking_payment", { p_stripe_payment_id: data.id });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const price = data.items?.data?.[0]?.price;
        await sb.rpc("rpc_record_subscription", {
          p_stripe_subscription_id: data.id,
          p_stripe_customer_id:     data.customer,
          p_status:                 data.status,
          p_stripe_price_id:        price?.id ?? null,
          p_amount:                 price?.unit_amount ?? 0,
          p_currency:               price?.currency ?? "eur",
          p_period_start:           data.current_period_start
            ? new Date(data.current_period_start * 1000).toISOString() : null,
          p_period_end:             data.current_period_end
            ? new Date(data.current_period_end * 1000).toISOString() : null,
          p_cancel_at_period_end:   data.cancel_at_period_end ?? false,
          p_metadata:               data.metadata ?? {},
        });
        break;
      }

      case "customer.subscription.deleted": {
        await sb.rpc("rpc_record_subscription", {
          p_stripe_subscription_id: data.id,
          p_stripe_customer_id:     data.customer,
          p_status:                 "canceled",
        });
        break;
      }

      case "payout.paid": {
        await sb.rpc("rpc_record_payout", {
          p_stripe_payout_id: data.id,
          p_amount:           data.amount,
          p_currency:         data.currency ?? "eur",
          p_status:           "paid",
          p_payout_type:      data.metadata?.payout_type ?? "platform",
          p_arrival_date:     data.arrival_date
            ? new Date(data.arrival_date * 1000).toISOString() : null,
          p_ambassador_id:    data.metadata?.ambassador_id ?? null,
        });
        break;
      }

      case "payout.failed": {
        const failReason = data.failure_message || data.failure_code || "unknown";
        await sb.rpc("rpc_record_payout", {
          p_stripe_payout_id: data.id,
          p_amount:           data.amount ?? 0,
          p_currency:         data.currency ?? "eur",
          p_status:           "failed",
          p_failed_reason:    failReason,
          p_ambassador_id:    data.metadata?.ambassador_id ?? null,
        });
        break;
      }

      case "charge.refunded": {
        // rpc_record_refund: speichert in stripe_refunds + korrigiert Pool + Ambassador-Provision atomisch
        if (data.payment_intent) {
          const refundObj = data.refunds?.data?.[0];
          await sb.rpc("rpc_record_refund", {
            p_stripe_payment_id: data.payment_intent,
            p_refund_amount:     data.amount_refunded ?? null,
            p_stripe_refund_id:  refundObj?.id ?? null,
            p_reason:            refundObj?.reason ?? null,
          });

          // Buchung live nachziehen, falls verknuepft (ARCH-006.1 Punkt 7)
          await sb.rpc("rpc_sync_booking_payment", { p_stripe_payment_id: data.payment_intent });
        }
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
