"use client";

// Client-side billing helpers. Wrap the /api/stripe/* routes with
// Firebase ID-token attachment + simple error handling.

import { getIdToken } from "./auth-context";

export type PaidPlan = "pro" | "professional";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error("로그인이 필요합니다");
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    let detail = "";
    try {
      detail = (await r.json()).error || "";
    } catch {
      /* ignore */
    }
    throw new Error(`${path} ${r.status}${detail ? ` (${detail})` : ""}`);
  }
  return (await r.json()) as T;
}

export async function startCheckout(plan: PaidPlan): Promise<void> {
  try {
    const { url } = await postJson<{ url: string }>("/api/stripe/checkout", { plan });
    window.location.href = url;
  } catch (e) {
    // If user already has an active subscription, just bounce them to the
    // Stripe Billing Portal so they can swap / cancel — no duplicate charge.
    if ((e as Error).message.includes("already_subscribed")) {
      await openBillingPortal();
      return;
    }
    throw e;
  }
}

export async function openBillingPortal(): Promise<void> {
  const { url } = await postJson<{ url: string }>("/api/stripe/portal", {});
  window.location.href = url;
}
