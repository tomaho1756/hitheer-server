"use client";

import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { getFirebaseApp } from "./firebase";

export interface Language {
  code: string;
  label: string;
}

// Keep the list short until we have proper i18n config / DB.
export const LANGUAGES: Language[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "vi", label: "Tiếng Việt" },
];

export interface LanguagePrefs {
  speaks: string[];
  wants: string[];
}

const KEY = "hithere:lang-prefs";

export function loadPrefs(): LanguagePrefs {
  if (typeof window === "undefined") return { speaks: [], wants: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { speaks: [], wants: [] };
    const parsed = JSON.parse(raw) as Partial<LanguagePrefs>;
    return {
      speaks: Array.isArray(parsed.speaks) ? parsed.speaks : [],
      wants: Array.isArray(parsed.wants) ? parsed.wants : [],
    };
  } catch {
    return { speaks: [], wants: [] };
  }
}

export function savePrefs(p: LanguagePrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
}

// ─── Firestore-backed (per-user) prefs ─────────────────────────────
// Stored at `users/{uid}` with fields { speaks: string[], wants: string[],
// updatedAt: serverTimestamp }. localStorage still mirrors it so guest mode
// keeps working and the home page can render before Firestore returns.

export async function loadUserPrefs(uid: string): Promise<LanguagePrefs | null> {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<LanguagePrefs>;
    return {
      speaks: Array.isArray(data.speaks) ? data.speaks : [],
      wants: Array.isArray(data.wants) ? data.wants : [],
    };
  } catch {
    return null;
  }
}

export async function saveUserPrefs(uid: string, p: LanguagePrefs): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;
  const db = getFirestore(app);
  await setDoc(
    doc(db, "users", uid),
    { speaks: p.speaks, wants: p.wants, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Helper: read from Firestore if signed in, otherwise localStorage.
// If Firestore has data we mirror it into localStorage so the home picker
// is pre-filled instantly next render.
export async function syncPrefsForUser(uid: string | undefined): Promise<LanguagePrefs> {
  if (!uid) return loadPrefs();
  const remote = await loadUserPrefs(uid);
  if (remote && (remote.speaks.length || remote.wants.length)) {
    savePrefs(remote);
    return remote;
  }
  // No remote yet — push local to remote on next save.
  return loadPrefs();
}
