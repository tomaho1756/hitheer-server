// POST /api/friends/accept
// Body: { senderUid: string, accept: boolean }
// Auth: Bearer <Firebase ID token>
// Effect:
//   - if accept: write users/{me}/friends/{sender} AND users/{sender}/friends/{me},
//     then delete both request docs.
//   - if !accept: just delete both request docs (a "decline").

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await verifyBearer(req);
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { senderUid?: string; accept?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const senderUid = body.senderUid;
  const accept = !!body.accept;
  if (!senderUid) {
    return NextResponse.json({ error: "missing_sender" }, { status: 400 });
  }

  const db = adminDb();
  const reqDoc = await db
    .doc(`users/${me.uid}/friend_requests/${senderUid}`)
    .get();
  if (!reqDoc.exists) {
    return NextResponse.json({ error: "request_not_found" }, { status: 404 });
  }

  const batch = db.batch();
  batch.delete(db.doc(`users/${me.uid}/friend_requests/${senderUid}`));
  batch.delete(db.doc(`users/${senderUid}/sent_requests/${me.uid}`));

  if (accept) {
    let senderName: string | null = null;
    let senderEmail: string | null = null;
    try {
      const u = await adminAuth().getUser(senderUid);
      senderName = u.displayName ?? null;
      senderEmail = u.email ?? null;
    } catch {
      /* user gone — still proceed with bare friend record */
    }
    batch.set(db.doc(`users/${me.uid}/friends/${senderUid}`), {
      friendUid: senderUid,
      displayName: senderName ?? "",
      email: senderEmail ?? "",
      since: FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`users/${senderUid}/friends/${me.uid}`), {
      friendUid: me.uid,
      displayName: me.name ?? "",
      email: me.email ?? "",
      since: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return NextResponse.json({ ok: true, accepted: accept });
}
