"use client";

// Conversation storage. When the user is signed in, we persist directly to
// Firestore (users/{uid}/conversations/...). Otherwise we POST to the
// signaling server's /conversations endpoint, which writes to SQLite — useful
// for local dev or guest mode but ephemeral on Cloud Run.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";

import { getFirebaseApp } from "./firebase";
import { getClientId } from "./client-id";

export interface SavedMessage {
  who: "me" | "peer";
  original: string;
  translated: string;
  langOriginal: string;
  langTranslated: string;
  ts: number;
}

export interface SaveInput {
  roomId: string;
  speakerLang: string;
  partnerLang: string;
  startedAt: number;
  endedAt: number;
  messages: SavedMessage[];
}

export interface ConversationSummary {
  id: string;
  roomId: string;
  speakerLang: string;
  partnerLang: string;
  startedAt: number;
  endedAt: number;
  messageCount: number;
}

export interface ConversationDetail extends ConversationSummary {
  messages: SavedMessage[];
}

/** Save a finished conversation. Picks Firestore if signed-in user is provided. */
export async function saveConversation(
  input: SaveInput,
  uid?: string | null
): Promise<void> {
  if (input.messages.length === 0) return;

  if (uid) {
    await saveToFirestore(uid, input);
    return;
  }

  await fetch(`${window.location.origin}/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: getClientId(),
      ...input,
    }),
    keepalive: true,
  });
}

async function saveToFirestore(uid: string, input: SaveInput): Promise<void> {
  const app = getFirebaseApp();
  if (!app) throw new Error("firebase not configured");
  const db = getFirestore(app);
  const id = `${input.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
  const convRef = doc(db, "users", uid, "conversations", id);
  await setDoc(convRef, {
    roomId: input.roomId,
    speakerLang: input.speakerLang,
    partnerLang: input.partnerLang,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    messageCount: input.messages.length,
    createdAt: Timestamp.now(),
  });
  // Batch the messages (max 500 per batch — we cap at 50 messages already).
  const batch = writeBatch(db);
  input.messages.forEach((m, idx) => {
    const mRef = doc(db, "users", uid, "conversations", id, "messages", `${idx}`);
    batch.set(mRef, m);
  });
  await batch.commit();
}

export async function listConversations(
  uid?: string | null
): Promise<ConversationSummary[]> {
  if (uid) {
    const app = getFirebaseApp();
    if (!app) return [];
    const db = getFirestore(app);
    const q = query(
      collection(db, "users", uid, "conversations"),
      orderBy("startedAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ConversationSummary, "id">),
    }));
  }
  const res = await fetch(
    `/conversations?clientId=${encodeURIComponent(getClientId())}`
  );
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as ConversationSummary[];
}

export async function getConversation(
  id: string,
  uid?: string | null
): Promise<ConversationDetail | null> {
  if (uid) {
    const app = getFirebaseApp();
    if (!app) return null;
    const db = getFirestore(app);
    const convRef = doc(db, "users", uid, "conversations", id);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return null;
    const msgsSnap = await getDocs(
      query(collection(db, "users", uid, "conversations", id, "messages"))
    );
    const messages = msgsSnap.docs
      .map((d) => d.data() as SavedMessage)
      .sort((a, b) => a.ts - b.ts);
    return {
      id: convSnap.id,
      ...(convSnap.data() as Omit<ConversationSummary, "id">),
      messages,
    };
  }
  const res = await fetch(`/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return (await res.json()) as ConversationDetail;
}
