"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  LANGUAGES,
  loadPrefs,
  loadUserPrefs,
  savePrefs,
  saveUserPrefs,
  type LanguagePrefs,
} from "@/lib/languages";

const T = {
  surface: "#ffffff",
  surfaceChip: "#eef0f4",
  text: "#18191a",
  textMuted: "#65676b",
  accent: "#03C75A",
  accentSoft: "#e8f8ee",
};

// Shared editor used by both mobile profile and desktop profile.
// `layout`: "chips" (radio-style buttons) or "dropdown" (native <select>).
// Single-selection only: each side holds at most one language.
export function LanguageSettings({
  variant = "card",
  layout = "chips",
}: {
  variant?: "card" | "plain";
  layout?: "chips" | "dropdown";
}) {
  const { user } = useAuth();
  const [speaks, setSpeaks] = useState<string>("");
  const [wants, setWants] = useState<string>("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    const local = loadPrefs();
    setSpeaks(local.speaks[0] ?? "");
    setWants(local.wants[0] ?? "");
    setHydrated(true);
    if (user) {
      loadUserPrefs(user.uid).then((remote) => {
        if (!alive || !remote) return;
        if (remote.speaks.length || remote.wants.length) {
          setSpeaks(remote.speaks[0] ?? "");
          setWants(remote.wants[0] ?? "");
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [user]);

  const select = (kind: "speaks" | "wants", code: string) => {
    if (kind === "speaks") setSpeaks(code);
    else setWants(code);
    void persist(kind === "speaks" ? code : speaks, kind === "wants" ? code : wants);
  };

  const persist = async (s: string, w: string) => {
    const p: LanguagePrefs = {
      speaks: s ? [s] : [],
      wants: w ? [w] : [],
    };
    savePrefs(p);
    if (!user) return;
    setSavingState("saving");
    try {
      await saveUserPrefs(user.uid, p);
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 1400);
    } catch {
      setSavingState("error");
    }
  };

  const isCard = variant === "card";

  return (
    <div
      style={
        isCard
          ? {
              background: T.surface,
              borderRadius: 14,
              padding: 18,
              boxShadow:
                "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)",
            }
          : {}
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 800,
            color: T.text,
            letterSpacing: -0.2,
          }}
        >
          언어 선호도
        </h3>
        <SaveStatus state={savingState} signedIn={!!user} />
      </div>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 11.5,
          color: T.textMuted,
          lineHeight: 1.5,
        }}
      >
        가능 언어와 원하는 언어는 <strong style={{ color: T.text }}>각각 하나만</strong> 선택할 수 있어요.
      </p>

      <SubLabel>내가 할 수 있는 언어</SubLabel>
      {layout === "dropdown" ? (
        <SelectField
          value={speaks}
          onChange={(c) => select("speaks", c)}
          disabled={!hydrated}
          placeholder="선택하기"
        />
      ) : (
        <ChipRow
          codes={speaks ? [speaks] : []}
          onSelect={(c) => select("speaks", c)}
          disabled={!hydrated}
        />
      )}
      <div style={{ height: 14 }} />
      <SubLabel>연습하고 싶은 언어</SubLabel>
      {layout === "dropdown" ? (
        <SelectField
          value={wants}
          onChange={(c) => select("wants", c)}
          disabled={!hydrated}
          placeholder="선택하기"
        />
      ) : (
        <ChipRow
          codes={wants ? [wants] : []}
          onSelect={(c) => select("wants", c)}
          disabled={!hydrated}
        />
      )}
      {!user && (
        <p
          style={{
            marginTop: 12,
            fontSize: 11.5,
            color: T.textMuted,
            lineHeight: 1.5,
          }}
        >
          로그인하면 다른 기기에서도 같은 설정이 적용돼요.
        </p>
      )}
    </div>
  );
}

function SaveStatus({
  state,
  signedIn,
}: {
  state: "idle" | "saving" | "saved" | "error";
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <span style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600 }}>
        로컬에만 저장
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600 }}>저장 중…</span>
    );
  }
  if (state === "saved") {
    return (
      <span
        style={{
          fontSize: 10.5,
          color: T.accent,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <CheckIcon />
        저장됨
      </span>
    );
  }
  if (state === "error") {
    return (
      <span style={{ fontSize: 10.5, color: "#dc2626", fontWeight: 700 }}>저장 실패</span>
    );
  }
  return null;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "0 0 8px",
        fontSize: 10.5,
        color: T.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function ChipRow({
  codes,
  onSelect,
  disabled,
}: {
  codes: string[];
  onSelect: (c: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {LANGUAGES.map((l) => {
        const sel = codes.includes(l.code);
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onSelect(l.code)}
            disabled={disabled}
            style={{
              padding: "7px 13px",
              background: sel ? T.accent : T.surfaceChip,
              color: sel ? "white" : T.text,
              border: "none",
              borderRadius: 999,
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 12.5,
              fontWeight: sel ? 700 : 500,
              boxShadow: sel ? `0 3px 8px ${T.accent}55` : "none",
              transition: "background 0.18s, transform 0.15s, box-shadow 0.18s",
              fontFamily: "inherit",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (c: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          padding: "12px 38px 12px 14px",
          background: T.surfaceChip,
          color: value ? T.text : T.textMuted,
          border: "none",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
        }}
      >
        <option value="" disabled>
          {placeholder ?? "선택"}
        </option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: T.textMuted,
          pointerEvents: "none",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
