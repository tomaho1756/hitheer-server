#!/usr/bin/env node
//
// Manual plan reconciliation. Pulls a user's *current* active Stripe
// subscription, writes it to users/{uid} in Firestore, and refreshes the
// `plan` custom claim. Use when the local webhook never reached its target
// (`stripe listen` misconfigured) so the user is left in a stuck state.
//
// Usage:
//   node scripts/sync-plan.mjs <firebaseUid>
//
// Requires: STRIPE_SECRET_KEY, FIREBASE_ADMIN_SA_JSON or GOOGLE_APPLICATION_CREDENTIALS
//           in apps/web/.env.local. Run from repo root.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, "apps/web/.env.local");

// Minimal .env loader so we don't pull in a dotenv dep.
for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)='?(.*?)'?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const uid = process.argv[2];
if (!uid) {
  console.error("usage: node scripts/sync-plan.mjs <firebaseUid>");
  process.exit(1);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error("STRIPE_SECRET_KEY not set in apps/web/.env.local");
  process.exit(1);
}
const PRICE_PRO = process.env.STRIPE_PRICE_PRO;
const PRICE_PROFESSIONAL = process.env.STRIPE_PRICE_PROFESSIONAL;

const planFromPriceId = (id) => {
  if (!id) return "free";
  if (id === PRICE_PRO) return "pro";
  if (id === PRICE_PROFESSIONAL) return "professional";
  return "free";
};

// Load apps/web's node_modules so we don't have to install anything in repo root.
const adminPath = path.join(REPO_ROOT, "apps/web/node_modules/firebase-admin");
const { initializeApp, cert, applicationDefault } = await import(`${adminPath}/lib/app/index.js`);
const { getFirestore, FieldValue } = await import(`${adminPath}/lib/firestore/index.js`);
const { getAuth } = await import(`${adminPath}/lib/auth/index.js`);

const saJson = process.env.FIREBASE_ADMIN_SA_JSON;
const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;

if (saJson) {
  const parsed = JSON.parse(saJson);
  initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
    }),
    projectId: parsed.project_id,
  });
} else if (gac) {
  initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
} else {
  console.error("no firebase admin creds (FIREBASE_ADMIN_SA_JSON or GOOGLE_APPLICATION_CREDENTIALS)");
  process.exit(1);
}

const db = getFirestore();
const auth = getAuth();

// 1. Look up the customer id from the user doc.
const userSnap = await db.doc(`users/${uid}`).get();
const stripeCustomerId =
  userSnap.exists ? userSnap.get("subscription.stripeCustomerId") : null;

if (!stripeCustomerId) {
  console.error(`users/${uid} has no subscription.stripeCustomerId — has this user ever started a checkout?`);
  process.exit(1);
}

// 2. Ask Stripe for live subscriptions on that customer.
const stripeFetch = async (path) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${STRIPE_KEY}:`).toString("base64")}` },
  });
  if (!r.ok) throw new Error(`stripe ${path} ${r.status} ${await r.text()}`);
  return r.json();
};
const subs = await stripeFetch(`subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&limit=10`);
const live = subs.data.find((s) =>
  ["active", "trialing", "past_due"].includes(s.status)
);

if (!live) {
  console.log("no active subscription — setting plan=free");
  await db.doc(`users/${uid}`).set(
    {
      plan: "free",
      planUpdatedAt: FieldValue.serverTimestamp(),
      subscription: {
        status: "none",
        priceId: null,
        stripeSubscriptionId: null,
        stripeCustomerId,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    },
    { merge: true }
  );
  await auth.setCustomUserClaims(uid, { plan: "free" });
} else {
  const priceId = live.items.data[0]?.price.id ?? null;
  const plan = planFromPriceId(priceId);
  console.log(`active sub ${live.id} priceId=${priceId} → plan=${plan}`);
  await db.doc(`users/${uid}`).set(
    {
      plan,
      planUpdatedAt: FieldValue.serverTimestamp(),
      subscription: {
        status: live.status,
        priceId,
        stripeSubscriptionId: live.id,
        stripeCustomerId,
        currentPeriodEnd: live.current_period_end ?? live.items.data[0]?.current_period_end ?? null,
        cancelAtPeriodEnd: !!live.cancel_at_period_end,
      },
    },
    { merge: true }
  );
  await auth.setCustomUserClaims(uid, { plan });
}

console.log("done. user must force-refresh ID token (re-login or wait ~1h) for the Rust signaling quota gate to see the new plan.");
process.exit(0);
