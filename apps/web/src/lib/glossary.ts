"use client";

// User glossary — small list of "always use this translation for term X"
// pairs. Stored in localStorage so it follows the browser; we don't bother
// syncing to Firestore yet because it's per-context (work vs personal calls).

import { GlossaryEntry } from "./realtime";

const KEY = "hithere:glossary";

export function loadGlossary(): GlossaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.term === "string" && e.term.trim().length > 0)
      .slice(0, 30)
      .map((e) => ({
        term: String(e.term).trim(),
        translation:
          typeof e.translation === "string" && e.translation.trim().length > 0
            ? String(e.translation).trim()
            : undefined,
      }));
  } catch {
    return [];
  }
}

export function saveGlossary(entries: GlossaryEntry[]): void {
  if (typeof window === "undefined") return;
  const sanitized = entries
    .filter((e) => e.term.trim().length > 0)
    .slice(0, 30);
  window.localStorage.setItem(KEY, JSON.stringify(sanitized));
}
