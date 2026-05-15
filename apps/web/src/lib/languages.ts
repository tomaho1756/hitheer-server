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
