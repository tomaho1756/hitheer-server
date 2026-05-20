"use client";

// Friend system client helpers + types. Storage lives in Firestore under
// users/{uid}/{friends,friend_requests,sent_requests,invitations}.

import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

import { getFirebaseApp } from "./firebase";
import { getIdToken } from "./auth-context";

export interface Friend {
  friendUid: string;
  displayName: string;
  email: string;
  since?: number;
}

export interface FriendRequest {
  senderUid: string;
  senderName: string;
  senderEmail: string;
  status: "pending";
  createdAt?: number;
}

export interface SentRequest {
  recipientUid: string;
  recipientName: string | null;
  recipientEmail: string;
  status: "pending";
}

export interface Invitation {
  fromUid: string;
  fromName: string;
  roomId: string;
  mineLang: string;
  peerLang: string;
}

function tsToMillis(t: unknown): number | undefined {
  if (t instanceof Timestamp) return t.toMillis();
  return undefined;
}

export function subscribeFriends(
  uid: string,
  cb: (friends: Friend[]) => void
): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const db = getFirestore(app);
  const q = query(collection(db, "users", uid, "friends"), orderBy("since", "desc"));
  return onSnapshot(q, (snap) => {
    const out: Friend[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<Friend> & { since?: unknown };
      out.push({
        friendUid: d.id,
        displayName: data.displayName ?? "",
        email: data.email ?? "",
        since: tsToMillis(data.since),
      });
    });
    cb(out);
  });
}

export function subscribeRequests(
  uid: string,
  cb: (requests: FriendRequest[]) => void
): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const db = getFirestore(app);
  const q = query(
    collection(db, "users", uid, "friend_requests"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const out: FriendRequest[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<FriendRequest> & { createdAt?: unknown };
      out.push({
        senderUid: data.senderUid ?? d.id,
        senderName: data.senderName ?? "",
        senderEmail: data.senderEmail ?? "",
        status: "pending",
        createdAt: tsToMillis(data.createdAt),
      });
    });
    cb(out);
  });
}

export function subscribeSentRequests(
  uid: string,
  cb: (sent: SentRequest[]) => void
): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const db = getFirestore(app);
  const q = collection(db, "users", uid, "sent_requests");
  return onSnapshot(q, (snap) => {
    const out: SentRequest[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<SentRequest>;
      out.push({
        recipientUid: data.recipientUid ?? d.id,
        recipientName: data.recipientName ?? null,
        recipientEmail: data.recipientEmail ?? "",
        status: "pending",
      });
    });
    cb(out);
  });
}

export function subscribeInvitations(
  uid: string,
  cb: (invs: Invitation[]) => void
): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const db = getFirestore(app);
  const q = collection(db, "users", uid, "invitations");
  return onSnapshot(q, (snap) => {
    const out: Invitation[] = [];
    snap.forEach((d) => {
      const data = d.data() as Partial<Invitation>;
      out.push({
        fromUid: data.fromUid ?? "",
        fromName: data.fromName ?? "친구",
        roomId: data.roomId ?? d.id,
        mineLang: data.mineLang ?? "ko",
        peerLang: data.peerLang ?? "en",
      });
    });
    cb(out);
  });
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error("로그인이 필요합니다");
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = "";
    try {
      detail = (await r.json()).error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${path} ${r.status}`);
  }
  return (await r.json()) as T;
}

export function sendFriendRequest(email: string) {
  return post("/api/friends/request", { email });
}

export function respondFriendRequest(senderUid: string, accept: boolean) {
  return post("/api/friends/accept", { senderUid, accept });
}

export function inviteFriendToCall(args: {
  friendUid: string;
  roomId: string;
  mineLang: string;
  peerLang: string;
}) {
  return post("/api/friends/invite", args);
}

// Decline an invitation by deleting its doc — the recipient can do this with
// their own Firestore credentials (covered by the generic users/{uid}/{**} rule).
export async function dismissInvitation(uid: string, roomId: string): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;
  const { deleteDoc } = await import("firebase/firestore");
  const db = getFirestore(app);
  await deleteDoc(doc(db, "users", uid, "invitations", roomId)).catch(() => undefined);
}
