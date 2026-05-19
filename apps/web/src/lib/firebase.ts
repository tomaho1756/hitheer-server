// Firebase web SDK initialization. The actual config values come from
// NEXT_PUBLIC_FIREBASE_* env vars so we can ship the same bundle to multiple
// environments. Fill these in `apps/web/.env.local` after registering the web
// app in the Firebase console (Project Settings → Your apps → </> Web).

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
  connectAuthEmulator,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return !!(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured()) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config as Record<string, string>);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const a = getFirebaseApp();
  if (!a) return null;
  authInstance = getAuth(a);
  // Optional local emulator: set NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR=http://localhost:9099
  const emu = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR;
  if (emu) {
    try {
      connectAuthEmulator(authInstance, emu, { disableWarnings: true });
    } catch {
      /* already connected */
    }
  }
  return authInstance;
}

export const googleProvider = new GoogleAuthProvider();
