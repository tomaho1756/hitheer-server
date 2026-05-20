// POST /api/friends/invite
// Body: { friendUid: string, roomId: string, mineLang: string, peerLang: string }
// Auth: Bearer <Firebase ID token>
// Effect: writes users/{friendUid}/invitations/{roomId} so their client picks
// it up via onSnapshot and shows the incoming-call modal.
//
// We do this server-side rather than directly from the client so we can
// confirm both parties are actually friends before letting one ring the other.

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb, verifyBearer } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await verifyBearer(req);
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { friendUid?: string; roomId?: string; mineLang?: string; peerLang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { friendUid, roomId, mineLang, peerLang } = body;
  if (!friendUid || !roomId || !mineLang || !peerLang) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = adminDb();
  const friendship = await db.doc(`users/${me.uid}/friends/${friendUid}`).get();
  if (!friendship.exists) {
    return NextResponse.json({ error: "not_friends" }, { status: 403 });
  }

  // The recipient sees mineLang as *peer*'s spoken language and vice versa.
  await db.doc(`users/${friendUid}/invitations/${roomId}`).set({
    fromUid: me.uid,
    fromName: me.name ?? me.email ?? "친구",
    roomId,
    mineLang: peerLang, // recipient's "mine" is sender's "peer"
    peerLang: mineLang, // recipient's "peer" is sender's "mine"
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
