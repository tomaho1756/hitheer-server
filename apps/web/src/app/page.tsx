"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LANGUAGES, loadPrefs, savePrefs } from "@/lib/languages";

export default function HomePage() {
  const router = useRouter();
  const [speaks, setSpeaks] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setSpeaks(p.speaks);
    setWants(p.wants);
    setHydrated(true);
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, code: string) => {
    setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  const startMatch = () => {
    savePrefs({ speaks, wants });
    router.push("/match");
  };

  const canMatch = speaks.length > 0 && wants.length > 0;

  return (
    <main style={{ maxWidth: 560, margin: "8vh auto", padding: 24 }}>
      <h1>hithere</h1>
      <p style={{ color: "#9aa3af" }}>
        Pick which languages you can speak and which you want to practice. We&rsquo;ll match you with
        someone whose preferences mirror yours.
      </p>

      <Section
        title="I can speak"
        codes={speaks}
        toggle={(c) => toggle(speaks, setSpeaks, c)}
      />
      <Section
        title="I want to practice"
        codes={wants}
        toggle={(c) => toggle(wants, setWants, c)}
      />

      <button
        onClick={startMatch}
        disabled={!canMatch || !hydrated}
        style={{
          marginTop: 28,
          width: "100%",
          padding: "14px 16px",
          background: canMatch ? "#3b82f6" : "#1f2937",
          color: canMatch ? "white" : "#6b7280",
          border: "none",
          borderRadius: 8,
          cursor: canMatch ? "pointer" : "not-allowed",
          fontSize: 16,
        }}
      >
        Match
      </button>
      {!canMatch && hydrated && (
        <p style={{ color: "#6b7280", marginTop: 8, fontSize: 13 }}>
          Pick at least one language in each row.
        </p>
      )}

      <details style={{ marginTop: 32, color: "#6b7280" }}>
        <summary style={{ cursor: "pointer" }}>dev: open a specific room</summary>
        <p style={{ fontSize: 13 }}>
          For WebRTC debugging only. Navigate to <code>/call/&lt;room-id&gt;</code> in two tabs.
        </p>
      </details>
    </main>
  );
}

function Section({
  title,
  codes,
  toggle,
}: {
  title: string;
  codes: string[];
  toggle: (code: string) => void;
}) {
  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#d1d5db" }}>{title}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LANGUAGES.map((l) => {
          const selected = codes.includes(l.code);
          return (
            <button
              key={l.code}
              onClick={() => toggle(l.code)}
              style={{
                padding: "6px 12px",
                background: selected ? "#3b82f6" : "#1a1d22",
                color: selected ? "white" : "#d1d5db",
                border: `1px solid ${selected ? "#3b82f6" : "#2a2f37"}`,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
