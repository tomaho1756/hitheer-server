"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { MobileFrame } from "./frame";

const T = {
  surface: "#ffffff",
  surfaceAlt: "#f4f5f8",
  surfaceWarm: "#fbf8f3",
  text: "#18191a",
  textMuted: "#65676b",
  textFaint: "#9ca3af",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
};

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function MobilePromo() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroLine1Ref = useRef<HTMLHeadingElement>(null);
  const heroLine2Ref = useRef<HTMLHeadingElement>(null);
  const heroLine3Ref = useRef<HTMLHeadingElement>(null);
  const heroBadgeRef = useRef<HTMLDivElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    if (!heroLine1Ref.current || !heroLine2Ref.current || !heroLine3Ref.current) return;

    // Split lines 1+2 into chars. Line 3 has gradient text (background-clip: text),
    // which breaks when each char becomes its own inline-block w/ transforms — keep it whole.
    const splitChars = (el: HTMLElement) => {
      const text = el.dataset.text || el.textContent || "";
      el.dataset.text = text;
      el.textContent = "";
      const chars: HTMLSpanElement[] = [];
      for (const ch of text) {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.style.transformOrigin = "50% 100%";
        span.style.willChange = "transform, opacity";
        span.textContent = ch === " " ? " " : ch;
        el.appendChild(span);
        chars.push(span);
      }
      return chars;
    };

    const c1 = splitChars(heroLine1Ref.current);
    const c2 = splitChars(heroLine2Ref.current);

    const ctx = gsap.context(() => {
      gsap.set([...c1, ...c2], { opacity: 0, y: 40, rotateX: -90 });
      gsap.set(heroLine3Ref.current, { opacity: 0, y: 30 });
      gsap.set(heroBadgeRef.current, { opacity: 0, y: -8 });
      gsap.set(heroSubRef.current, { opacity: 0, y: 14 });

      const tl = gsap.timeline({ delay: 0.05 });
      tl.to(heroBadgeRef.current, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
      tl.to(
        [...c1, ...c2],
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.035,
        },
        "-=0.25"
      );
      tl.to(
        heroLine3Ref.current,
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.3"
      );
      tl.to(heroSubRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3");

      if (orbARef.current) {
        gsap.to(orbARef.current, {
          x: 20, y: -10, duration: 6, ease: "sine.inOut", yoyo: true, repeat: -1,
        });
      }
      if (orbBRef.current) {
        gsap.to(orbBRef.current, {
          x: -25, y: 15, duration: 7.5, ease: "sine.inOut", yoyo: true, repeat: -1,
        });
      }

      const blocks = rootRef.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [];
      blocks.forEach((el) => {
        gsap.from(el, {
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <MobileFrame title="hithere 소개" contentBg={T.surface}>
      <div ref={rootRef} style={{ flex: 1 }}>
        {/* HERO */}
        <section
          style={{
            position: "relative",
            padding: "56px 18px 64px",
            background:
              "radial-gradient(ellipse at 30% 0%, #1a1a1a 0%, #0a0a0a 60%, #050505 100%)",
            color: "white",
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <div
            ref={orbARef}
            aria-hidden
            style={{
              position: "absolute",
              top: -60,
              left: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(3,199,90,0.4) 0%, transparent 70%)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          />
          <div
            ref={orbBRef}
            aria-hidden
            style={{
              position: "absolute",
              bottom: -60,
              right: -40,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(108,92,231,0.3) 0%, transparent 70%)",
              filter: "blur(24px)",
              pointerEvents: "none",
            }}
          />

          <div
            ref={heroBadgeRef}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 13px",
              background: "rgba(3,199,90,0.18)",
              color: "#bcefcc",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              borderRadius: 999,
              marginBottom: 22,
              boxShadow: "inset 0 0 0 1px rgba(3,199,90,0.25)",
            }}
          >
            ⚡ Powered by OpenAI Realtime
          </div>
          <h1
            ref={heroLine1Ref}
            data-text="ANY"
            style={heroLineStyle}
          >
            ANY
          </h1>
          <h1
            ref={heroLine2Ref}
            data-text="LANGUAGE"
            style={heroLineStyle}
          >
            LANGUAGE
          </h1>
          <h1
            ref={heroLine3Ref}
            data-text="TRANSLATED."
            style={{
              ...heroLineStyle,
              background: "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            TRANSLATED.
          </h1>
          <p
            ref={heroSubRef}
            style={{
              position: "relative",
              margin: "22px auto 0",
              maxWidth: 320,
              fontSize: 14,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            모국어로 말해도 즉시 상대 언어로 번역돼서 자막으로 떠요.
          </p>
        </section>

        {/* Features */}
        <section style={{ padding: "34px 18px 12px" }}>
          <SectionTitle>뭐가 다른가요?</SectionTitle>
          <FeatureCard
            tint="#e8f8ee"
            emoji="🌐"
            title="실시간 번역"
            desc="OpenAI Realtime API. 토큰 단위로 자막이 흘러내려요."
          />
          <FeatureCard
            tint="#eef0ff"
            emoji="🎬"
            title="P2P 영상 통화"
            desc="WebRTC로 직접 연결. 서버 안 거쳐서 지연도 낮음."
          />
          <FeatureCard
            tint="#fff3e8"
            emoji="📝"
            title="자동 기록"
            desc="원문 + 번역 모두 저장. 나중에 다시 보면서 복습."
          />
        </section>

        {/* Stats */}
        <section style={{ padding: "12px 18px 26px" }}>
          <div
            data-reveal
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
          >
            <StatCell value="8+" label="언어" />
            <StatCell value="~200ms" label="지연" />
            <StatCell value="무료" label="베타" />
          </div>
        </section>

        {/* Use cases */}
        <section style={{ padding: "34px 18px 12px", background: T.surfaceWarm }}>
          <SectionTitle>이런 때 써보세요</SectionTitle>
          <UseCaseRow
            tag="여행"
            tint="#eef0ff"
            emoji="✈️"
            body="외국 친구한테 링크 보내고 모국어 그대로 수다"
          />
          <UseCaseRow
            tag="학습"
            tint="#e8f8ee"
            emoji="🗣️"
            body="원어민과 매칭 → 실전 회화 + 자막 피드백"
          />
          <UseCaseRow
            tag="업무"
            tint="#fff3e8"
            emoji="💼"
            body="다국적 미팅. 대화 기록은 회의록 초안"
          />
        </section>

        {/* CTA */}
        <section style={{ padding: "30px 18px 20px", background: T.surfaceWarm }}>
          <button
            data-reveal
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: "16px",
              background: "linear-gradient(135deg, #03C75A 0%, #04a04a 100%)",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow:
                "0 10px 26px rgba(3,199,90,0.45), 0 2px 6px rgba(3,199,90,0.3)",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            지금 시작하기
            <ArrowRightIcon />
          </button>
        </section>

        {/* Credit */}
        <section
          style={{
            padding: "16px 18px 40px",
            background: T.surfaceWarm,
            textAlign: "center",
          }}
        >
          <a
            href="https://github.com/tomaho1756"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.05)",
              color: T.textMuted,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <GithubIcon />
            Made by <strong style={{ color: T.text, fontWeight: 800 }}>@tomaho1756</strong>
          </a>
          <div style={{ marginTop: 8, fontSize: 10.5, color: T.textFaint }}>
            TOMAHO · hithere v0.1.0 (beta)
          </div>
        </section>
      </div>
    </MobileFrame>
  );
}

const heroLineStyle: React.CSSProperties = {
  position: "relative",
  margin: 0,
  fontSize: "clamp(40px, 14vw, 64px)",
  fontWeight: 900,
  letterSpacing: "-0.035em",
  lineHeight: 0.96,
  color: "white",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      data-reveal
      style={{
        margin: "0 0 16px",
        fontSize: 19,
        fontWeight: 900,
        color: T.text,
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </h2>
  );
}

function FeatureCard({
  tint,
  emoji,
  title,
  desc,
}: {
  tint: string;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      data-reveal
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "16px 16px 16px 14px",
        background: T.surface,
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04)",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: tint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: T.textMuted, lineHeight: 1.55 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function UseCaseRow({
  tag,
  tint,
  emoji,
  body,
}: {
  tag: string;
  tint: string;
  emoji: string;
  body: string;
}) {
  return (
    <div
      data-reveal
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "13px 14px",
        background: T.surface,
        borderRadius: 12,
        marginBottom: 8,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: tint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-block",
            background: T.accentSoft,
            color: T.accentDeep,
            padding: "2px 8px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            borderRadius: 999,
            marginBottom: 4,
          }}
        >
          {tag}
        </div>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        padding: "18px 6px",
        textAlign: "center",
        background: T.surface,
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          background: "linear-gradient(135deg, #03C75A 0%, #5ee49b 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────
function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 3 1.4 3.7 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}
