// POST /api/stripe/checkout
// Body: { plan: "pro" | "professional" }
// Auth: Bearer <Firebase ID token>
// Returns: { url: string }   — Stripe Checkout URL to redirect the browser to.

import { NextResponse } from "next/server";

import { verifyBearer, adminDb } from "@/lib/firebase-admin";
import { getStripe, PRICE_TABLE } from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await verifyBearer(req);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const plan = body.plan;
  if (plan !== "pro" && plan !== "professional") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  const priceId = PRICE_TABLE[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured", plan },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const db = adminDb();

  // Reuse stripeCustomerId if we've already seen this user; otherwise create
  // one and store it. We don't *have* to pre-create — Checkout can do it —
  // but pinning customer IDs makes future portal/webhook flows simpler.
  const userRef = db.collection("users").doc(user.uid);
  const userSnap = await userRef.get();
  let stripeCustomerId =
    (userSnap.exists && (userSnap.get("subscription.stripeCustomerId") as string)) ||
    null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { firebaseUid: user.uid },
    });
    stripeCustomerId = customer.id;
    await userRef.set(
      {
        subscription: { stripeCustomerId },
      },
      { merge: true }
    );
  }

  // Refuse to start a second checkout if the customer already has an active
  // (or trialing/past_due) subscription — that's how we ended up with
  // duplicate billing earlier. Hand them the Billing Portal instead so they
  // can change plan / cancel.
  const existing = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 5,
  });
  const live = existing.data.find((s) =>
    ["active", "trialing", "past_due", "incomplete"].includes(s.status)
  );
  if (live) {
    return NextResponse.json(
      {
        error: "already_subscribed",
        currentPriceId: live.items.data[0]?.price.id ?? null,
        currentStatus: live.status,
        hint: "use /api/stripe/portal to change plan or cancel",
      },
      { status: 409 }
    );
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    "http://localhost:3100";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: user.uid,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    metadata: { firebaseUid: user.uid, plan },
    subscription_data: {
      metadata: { firebaseUid: user.uid, plan },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
