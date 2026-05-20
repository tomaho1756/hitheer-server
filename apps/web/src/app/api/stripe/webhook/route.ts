// POST /api/stripe/webhook
// Stripe signed webhook. Updates users/{uid}.plan + subscription.* + Firebase
// custom claims so the Rust signaling server can read plan from the ID token.
//
// Idempotency: every processed event.id is recorded in stripe_events/{id}.
// If we see the same event again we no-op.

import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getStripe, planFromPriceId, type Plan } from "@/lib/stripe-server";

export const runtime = "nodejs";
// Don't let Next parse the body — Stripe needs the raw bytes to verify the signature.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_signature", detail: (e as Error).message },
      { status: 400 }
    );
  }

  const db = adminDb();
  const eventRef = db.collection("stripe_events").doc(event.id);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) {
    // Already processed — Stripe retries on 5xx, so this is normal.
    return NextResponse.json({ ok: true, dedup: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        await logInvoice(event);
        break;
      default:
        // Unhandled event — still record id so we don't reprocess unknowns.
        break;
    }

    await eventRef.set({
      type: event.type,
      createdAt: FieldValue.serverTimestamp(),
      livemode: event.livemode,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stripe-webhook]", event.type, e);
    return NextResponse.json(
      { error: "processing_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const uid = session.client_reference_id || (session.metadata?.firebaseUid as string | undefined);
  if (!uid) return;

  // For subscription mode, the full subscription record drives state; fetching
  // it here lets us write a single consistent snapshot.
  if (session.mode === "subscription" && session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await getStripe().subscriptions.retrieve(subId);
    await applySubscription(uid, sub);
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  // Locate uid: prefer subscription metadata, fall back to looking up the customer.
  let uid = sub.metadata?.firebaseUid;
  if (!uid && typeof sub.customer === "string") {
    const customer = await getStripe().customers.retrieve(sub.customer);
    if (!("deleted" in customer) || !customer.deleted) {
      uid = (customer as Stripe.Customer).metadata?.firebaseUid;
    }
  }
  if (!uid) return;
  await applySubscription(uid, sub);
}

async function applySubscription(uid: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  // Active states keep the paid plan; otherwise revert to free.
  const active =
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due"; // past_due still grants access until canceled
  const plan: Plan = active ? planFromPriceId(priceId) : "free";

  const db = adminDb();
  await db.collection("users").doc(uid).set(
    {
      plan,
      planUpdatedAt: FieldValue.serverTimestamp(),
      subscription: {
        status: sub.status,
        priceId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        // `current_period_end` is on the subscription's first item in 2025 API; fall back gracefully.
        currentPeriodEnd:
          (sub as unknown as { current_period_end?: number }).current_period_end ??
          sub.items.data[0]?.current_period_end ??
          null,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      },
    },
    { merge: true }
  );

  // Mirror plan into Firebase custom claims so the Rust signaling server can
  // read it from the ID token without hitting Firestore on every session start.
  // Claims propagate to clients on next token refresh (≤ 1 hour, or force refresh).
  try {
    await adminAuth().setCustomUserClaims(uid, { plan });
  } catch (e) {
    console.warn("[stripe-webhook] custom claim update failed", uid, e);
  }
}

async function logInvoice(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  // Find uid via customer metadata.
  if (typeof invoice.customer !== "string") return;
  const customer = await getStripe().customers.retrieve(invoice.customer);
  if ("deleted" in customer && customer.deleted) return;
  const uid = (customer as Stripe.Customer).metadata?.firebaseUid;
  if (!uid) return;

  await adminDb()
    .collection("users")
    .doc(uid)
    .collection("billing_events")
    .doc(event.id)
    .set({
      type: event.type,
      amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
      currency: invoice.currency,
      status: invoice.status,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
}
