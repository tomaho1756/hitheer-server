// Server-side Firebase Admin SDK. Used by Stripe webhook + friend API routes
// where we need to bypass Firestore security rules and verify ID tokens.
//
// Credentials resolution order:
//   1. FIREBASE_ADMIN_SA_JSON (full service account JSON, single env var — easiest for App Hosting / Cloud Run)
//   2. GOOGLE_APPLICATION_CREDENTIALS (file path, standard GCP convention)
//   3. Application Default Credentials (works on GCP without explicit config)
//
// Initialized lazily so module import is cheap and dev-mode hot reload doesn't
// reinitialize the app on every request.

import { cert, getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const APP_NAME = "hithere-admin";

let initialized = false;

function ensureApp() {
  if (initialized) return getApp(APP_NAME);
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    initialized = true;
    return existing;
  }

  const saJson = process.env.FIREBASE_ADMIN_SA_JSON;
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (saJson) {
    const parsed = JSON.parse(saJson);
    initializeApp(
      {
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: (parsed.private_key as string).replace(/\\n/g, "\n"),
        }),
        projectId: parsed.project_id,
      },
      APP_NAME
    );
  } else {
    initializeApp(
      {
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {}),
      },
      APP_NAME
    );
  }
  initialized = true;
  return getApp(APP_NAME);
}

export function adminAuth() {
  return getAuth(ensureApp());
}

export function adminDb() {
  return getFirestore(ensureApp());
}

// Helper: verify a Firebase ID token from the `Authorization: Bearer …` header.
// Returns the decoded uid + claims, or null if missing/invalid.
export async function verifyBearer(req: Request): Promise<{
  uid: string;
  email: string | null;
  name: string | null;
  claims: Record<string, unknown>;
} | null> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      claims: decoded as unknown as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
