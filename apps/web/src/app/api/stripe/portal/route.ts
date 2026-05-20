// POST /api/stripe/portal
// Auth: Bearer <Firebase ID token>
// Returns: { url: string }  — Stripe Billing Portal URL.
//
// Used so users can change plan, cancel, update card without leaving Stripe.

import { NextResponse } from "next/server";

import { verifyBearer, adminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await verifyBearer(req);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const userSnap = await adminDb().collection("users").doc(user.uid).get();
  const stripeCustomerId = userSnap.get("subscription.stripeCustomerId") as
    | string
    | undefined;
  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "no_customer", hint: "user has not started a checkout yet" },
      { status: 400 }
    );
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    "http://localhost:3100";

  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${origin}/profile`,
  });

  return NextResponse.json({ url: session.url });
}
