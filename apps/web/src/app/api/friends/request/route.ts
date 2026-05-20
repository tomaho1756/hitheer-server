// POST /api/friends/request
// Body: { email: string }
// Auth: Bearer <Firebase ID token>
// Effect: creates users/{recipientUid}/friend_requests/{senderUid} (admin SDK)
//
// Doing the recipient lookup + cross-user write server-side lets us:
//   - Validate the recipient exists.
//   - Reject self-requests.
//   - Avoid leaking which emails are registered (vague 404 either way).

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await verifyBearer(req);
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });
  if (me.email?.toLowerCase() === email) {
    return NextResponse.json({ error: "cannot_friend_self" }, { status: 400 });
  }

  // Look up recipient by email. Use Firebase Auth (authoritative) rather than
  // user_lookup so we work even if the recipient hasn't visited since the
  // directory was rolled out.
  let recipientUid: string;
  let recipientName: string | null = null;
  try {
    const userRecord = await adminAuth().getUserByEmail(email);
    recipientUid = userRecord.uid;
    recipientName = userRecord.displayName ?? null;
  } catch {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const db = adminDb();
  // Reject duplicate request or already-friends.
  const friendDoc = await db
    .doc(`users/${me.uid}/friends/${recipientUid}`)
    .get();
  if (friendDoc.exists) {
    return NextResponse.json({ error: "already_friends" }, { status: 409 });
  }
  const sentDoc = await db
    .doc(`users/${recipientUid}/friend_requests/${me.uid}`)
    .get();
  if (sentDoc.exists) {
    return NextResponse.json({ error: "already_requested" }, { status: 409 });
  }

  await db
    .doc(`users/${recipientUid}/friend_requests/${me.uid}`)
    .set({
      senderUid: me.uid,
      senderName: me.name ?? "",
      senderEmail: me.email ?? "",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  // Mirror in sender's sent_requests for UI.
  await db
    .doc(`users/${me.uid}/sent_requests/${recipientUid}`)
    .set({
      recipientUid,
      recipientName,
      recipientEmail: email,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true });
}
