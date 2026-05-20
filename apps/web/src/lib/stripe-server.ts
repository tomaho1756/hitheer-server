// Server-side Stripe SDK. Lazily initialized so route handlers fail fast with
// a clear error if STRIPE_SECRET_KEY is missing rather than crashing at module
// load time during dev.

import Stripe from "stripe";

export type Plan = "free" | "pro" | "professional";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (sandbox key) or App Hosting env."
    );
  }
  cached = new Stripe(key, {
    typescript: true,
    // Pin a recent API version. Bump intentionally when migrating.
    apiVersion: "2026-04-22.dahlia",
  });
  return cached;
}

export const PRICE_TABLE: Record<Exclude<Plan, "free">, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
};

export function planFromPriceId(priceId: string | undefined | null): Plan {
  if (!priceId) return "free";
  if (priceId === PRICE_TABLE.pro) return "pro";
  if (priceId === PRICE_TABLE.professional) return "professional";
  return "free";
}

// Daily translation seconds budget per plan. Used by the Rust signaling server
// (mirrored there) and shown on the pricing page.
export const DAILY_LIMIT_SECONDS: Record<Plan, number> = {
  free: 30 * 60, // 30 min
  pro: 5 * 60 * 60, // 5 h
  professional: Number.POSITIVE_INFINITY,
};
