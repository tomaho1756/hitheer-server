"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { LANGUAGES, loadPrefs, savePrefs } from "@/lib/languages";
import { AccountPill } from "@/lib/account-pill";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile, useIsNarrow } from "@/lib/use-is-mobile";
import { MobileHome } from "@/components/mobile/home";

// ─── theme ───────────────────────────────────────────────────────────
const ACCENT = "#03C75A";
const ACCENT_DEEP = "#02a949";
const ACCENT_SOFT = "#e8f8ee";
const BORDER = "#e5e7eb";
const BORDER_SOFT = "#ebebeb";
const SURFACE = "#ffffff";
const SURFACE_ALT = "#f1f3f5";
const SURFACE_WARM = "#faf9f7";
const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const PAGE_BG = "#ffffff";
const DARK_BG = "#0a0a0a";

const NAV_HEIGHT = 72;

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Convenience hook: only run effect on the client, with a clean SSR fallback.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function HomePage() {
  return (
    <>
      <div className="app-desktop-only" style={{ background: PAGE_BG, overflowX: "hidden" }}>
        <NavBar />
        <Hero />
        <Intro />
        <Stats />
        <UseCases />
        <MatchSection />
        <FAQ />
        <Footer />
      </div>
      <div className="app-mobile-only">
        <MobileHome />
      </div>
    </>
  );
}

// ─── NavBar ──────────────────────────────────────────────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        transition: "background 0.25s, border-color 0.25s",
        background: scrolled ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.0)",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: scrolled ? TEXT : "white",
            transition: "color 0.25s",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 17,
              boxShadow: `0 2px 8px ${ACCENT}66`,
            }}
          >
            h
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>hithere</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 18 }}>
          {!isMobile && (
            <>
              <NavLink href="#how" color={scrolled ? TEXT_MUTED : "rgba(255,255,255,0.8)"}>
                사용법
              </NavLink>
              <NavLink href="/history" color={scrolled ? TEXT_MUTED : "rgba(255,255,255,0.8)"}>
                기록
              </NavLink>
            </>
          )}
          <AccountPill returnTo="/" />
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  color,
  children,
}: {
  href: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color,
        fontSize: 13.5,
        textDecoration: "none",
        fontWeight: 500,
        transition: "color 0.2s",
      }}
    >
      {children}
    </Link>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────
function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Force-mute on every paint — React's `muted` JSX prop is sometimes dropped
  // by SSR/hydration so we re-assert it here. Bullet-proof against browsers
  // that try to autoplay with sound after a user gesture.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.volume = 0;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    // Re-enforce whenever someone (or the browser) toggles it.
    const enforce = () => {
      v.muted = true;
      v.volume = 0;
    };
    v.addEventListener("volumechange", enforce);
    return () => v.removeEventListener("volumechange", enforce);
  }, []);

  useIsoLayoutEffect(() => {
    if (!line1Ref.current || !line2Ref.current) return;

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

    const c1 = splitChars(line1Ref.current);
    const c2 = splitChars(line2Ref.current);

    const ctx = gsap.context(() => {
      // Entrance.
      gsap.set([...c1, ...c2], { opacity: 0, y: 60, rotateX: -90 });
      gsap.set(badgeRef.current, { opacity: 0, y: -10 });
      gsap.set(subRef.current, { opacity: 0, y: 20 });
      gsap.set(ctaRef.current, { opacity: 0, y: 20 });
      gsap.set(indicatorRef.current, { opacity: 0 });

      const tl = gsap.timeline({ delay: 0.1 });
      tl.to(badgeRef.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
      tl.to(
        [...c1, ...c2],
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.035,
        },
        "-=0.3"
      );
      tl.to(subRef.current, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, "-=0.45");
      tl.to(ctaRef.current, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, "-=0.4");
      tl.to(indicatorRef.current, { opacity: 1, duration: 0.6 }, "-=0.2");

      // Parallax — translate only, no opacity fade. Including opacity here
      // was racing the entrance tween + the scrub, which sometimes left the
      // CTA at opacity:0 once the trigger captured its start value. Now
      // CTAs stay solid until they naturally scroll off-screen.
      if (sectionRef.current) {
        gsap.to(
          [line1Ref.current, line2Ref.current, badgeRef.current],
          {
            y: -120,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: "bottom top",
              scrub: 0.5,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        background: DARK_BG,
        color: "white",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
      }}
    >
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        data-bg=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // Soft blur on the video so faces / details stay abstract. The
          // cutout headlines still reveal the blurred frame, which reads as
          // a moving, ambient background.
          filter: "blur(14px) saturate(1.1)",
          // Scale up so the blur's soft edges don't show as black borders.
          transform: "scale(1.08)",
          zIndex: 0,
        }}
      >
        <source src="/hero_video.mp4" type="video/mp4" />
      </video>
      {/*
        Both layers share IDENTICAL content; one shows just the headlines
        (multiply blend → cutout effect), the other shows just the UI
        (badge / subtitle / CTA, normal blend). visibility:hidden keeps the
        hidden elements taking the same vertical space so the two stacks
        align across every breakpoint.
      */}
      <HeroLayer kind="cutout">
        <HeroContent
          line1Ref={line1Ref}
          line2Ref={line2Ref}
          show="headlines"
        />
      </HeroLayer>
      <HeroLayer kind="ui">
        <HeroContent
          badgeRef={badgeRef}
          subRef={subRef}
          ctaRef={ctaRef}
          show="ui"
        />
      </HeroLayer>

      {/* Scroll indicator */}
      <div
        ref={indicatorRef}
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        <span style={{ fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Scroll
        </span>
        <svg
          className="animate-scroll-bounce"
          width="18"
          height="22"
          viewBox="0 0 18 22"
          fill="none"
        >
          <path
            d="M9 1v18m0 0l7-7m-7 7l-7-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}

function Spacer({ height }: { height: number }) {
  return <div aria-hidden style={{ height, flexShrink: 0 }} />;
}

// ─── Hero layer wrappers ─────────────────────────────────────────────
// Two stacked absolute layers with identical content; one cuts through the
// blurred video, the other carries the regular UI on top.

const headlineFontStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  lineHeight: 0.95,
  letterSpacing: "-0.022em",
  // Tighter clamp than before so it doesn't blow up on narrow screens.
  fontSize: "clamp(44px, 11vw, 168px)",
  textAlign: "center",
};

function HeroLayer({
  kind,
  children,
}: {
  kind: "cutout" | "ui";
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 20px",
    textAlign: "center",
  };
  if (kind === "cutout") {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          background: "#555555", // lighter than before — less dim
          mixBlendMode: "multiply",
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    );
  }
  return <div style={{ ...base, zIndex: 2 }}>{children}</div>;
}

function HeroContent({
  show,
  line1Ref,
  line2Ref,
  badgeRef,
  subRef,
  ctaRef,
}: {
  show: "headlines" | "ui";
  line1Ref?: React.RefObject<HTMLHeadingElement | null>;
  line2Ref?: React.RefObject<HTMLHeadingElement | null>;
  badgeRef?: React.RefObject<HTMLDivElement | null>;
  subRef?: React.RefObject<HTMLParagraphElement | null>;
  ctaRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const headlinesHidden = show !== "headlines";
  const uiHidden = show !== "ui";

  return (
    <>
      <h1
        ref={line1Ref}
        data-text="ANY LANGUAGE,"
        style={{
          ...headlineFontStyle,
          color: "white",
          visibility: headlinesHidden ? "hidden" : "visible",
        }}
      >
        ANY LANGUAGE,
      </h1>
      <h1
        ref={line2Ref}
        data-text="TRANSLATED."
        style={{
          ...headlineFontStyle,
          // Soft green: multiplied with bright video gives a translucent
          // green tint rather than a solid green block.
          color: "#a8e0bb",
          visibility: headlinesHidden ? "hidden" : "visible",
        }}
      >
        TRANSLATED.
      </h1>

      <p
        ref={subRef}
        style={{
          margin: "28px auto 0",
          maxWidth: 580,
          fontSize: 16,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 1px 8px rgba(0,0,0,0.45)",
          visibility: uiHidden ? "hidden" : "visible",
          pointerEvents: uiHidden ? "none" : "auto",
        }}
      >
        전 세계 누구와도 모국어 그대로 대화하세요. 말하는 즉시 상대방 언어로 번역돼 자막으로
        뜨고, 대화 기록은 자동 저장돼요.
      </p>

      <div
        ref={ctaRef}
        style={{
          marginTop: 28,
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
          visibility: uiHidden ? "hidden" : "visible",
          pointerEvents: uiHidden ? "none" : "auto",
        }}
      >
        <a
          href="#match"
          style={{
            padding: "14px 28px",
            background: ACCENT,
            color: "white",
            border: `1px solid ${ACCENT}`,
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: `0 6px 20px ${ACCENT}66`,
          }}
        >
          지금 시작하기 →
        </a>
        <a
          href="#how"
          style={{
            padding: "14px 24px",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          사용법 보기
        </a>
      </div>
    </>
  );
}

// ─── Intro / Transition section ──────────────────────────────────────
function Intro() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: titleRef.current, start: "top 80%", once: true },
      });
      gsap.from(subRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        delay: 0.1,
        scrollTrigger: { trigger: subRef.current, start: "top 80%", once: true },
      });
      gsap.from(cardRef.current, {
        y: 60,
        opacity: 0,
        scale: 0.94,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: cardRef.current, start: "top 80%", once: true },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        background:
          "linear-gradient(180deg, #ffffff 0%, #f8f9fa 60%, #f0f2f5 100%)",
        padding: "var(--section-py) var(--section-px) calc(var(--section-py) * 0.85)",
        overflow: "hidden",
      }}
    >
      {/* decorative orbs */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
          opacity: 0.07,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-150px",
          left: "-100px",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, #7c3aed, transparent 70%)",
          opacity: 0.05,
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1000,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          ref={titleRef}
          style={{
            margin: 0,
            fontSize: "clamp(32px, 5.5vw, 56px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            color: TEXT,
          }}
        >
          모든 대화가 <span style={{ color: ACCENT }}>모국어처럼</span>.
        </h2>
        <p
          ref={subRef}
          style={{
            margin: "20px auto 0",
            maxWidth: 600,
            fontSize: 17,
            lineHeight: 1.55,
            color: TEXT_MUTED,
          }}
        >
          OpenAI Realtime API로 입에서 떨어지는 순간 번역. WebRTC로 직접 연결돼 지연도 거의 없어요.
        </p>

        {/* Faux chat preview */}
        <div
          ref={cardRef}
          style={{
            marginTop: 56,
            maxWidth: 680,
            marginLeft: "auto",
            marginRight: "auto",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 26,
            textAlign: "left",
            boxShadow:
              "0 20px 60px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              alignItems: "center",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#28c840" }} />
            <span style={{ marginLeft: 8, fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>
              conversation · ko → en
            </span>
          </div>
          <ChatBubble who="me" original="안녕하세요, 반갑습니다." translated="Hello, nice to meet you." />
          <ChatBubble
            who="peer"
            original="Where are you from?"
            translated="어디서 오셨어요?"
          />
          <ChatBubble who="me" original="서울에서 왔어요." translated="I'm from Seoul." />
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  who,
  original,
  translated,
}: {
  who: "me" | "peer";
  original: string;
  translated: string;
}) {
  const mine = who === "me";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          background: mine ? ACCENT : SURFACE_ALT,
          color: mine ? "white" : TEXT,
          padding: "10px 14px",
          borderRadius: 14,
          borderBottomRightRadius: mine ? 4 : 14,
          borderBottomLeftRadius: mine ? 14 : 4,
          fontSize: 13,
          lineHeight: 1.45,
          boxShadow: mine
            ? `0 1px 3px ${ACCENT}66`
            : "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <div style={{ opacity: 0.75, fontSize: 11 }}>{original}</div>
        <div style={{ marginTop: 2, fontWeight: 600 }}>{translated}</div>
      </div>
    </div>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────
function Stats() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const cells = ref.current!.querySelectorAll<HTMLDivElement>("[data-stat]");
      gsap.from(cells, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const cells = [
    { value: "8+", label: "지원 언어", hint: "한 · 영 · 일 · 중 · 스 · 프 · 독 · 베 …" },
    { value: "~200ms", label: "번역 지연", hint: "말하면 자막이 거의 동시에 흘러요" },
    { value: "$0", label: "베타 기간 요금", hint: "유료 기능은 회의 녹화 / 분석 (예정)" },
  ];

  return (
    <section
      ref={ref}
      style={{
        padding: "var(--section-py-tight) var(--section-px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 0,
          border: `1px solid ${BORDER_SOFT}`,
          borderRadius: 16,
          overflow: "hidden",
          background: SURFACE,
        }}
      >
        {cells.map((c, i) => (
          <div
            key={c.label}
            data-stat
            style={{
              padding: "28px 26px",
              textAlign: "center",
              borderLeft: i === 0 ? "none" : `1px solid ${BORDER_SOFT}`,
            }}
          >
            <div
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 900,
                color: ACCENT,
                letterSpacing: -0.7,
                lineHeight: 1,
              }}
            >
              {c.value}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 13.5,
                fontWeight: 700,
                color: TEXT,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: TEXT_MUTED,
                lineHeight: 1.5,
              }}
            >
              {c.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Use Cases ───────────────────────────────────────────────────────
function UseCases() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      const cards = ref.current!.querySelectorAll<HTMLDivElement>("[data-uc]");
      gsap.from(cards, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.14,
        scrollTrigger: { trigger: ref.current, start: "top 80%", once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const cases = [
    {
      emoji: "✈️",
      tag: "여행 · 교류",
      title: "외국 친구와 통화",
      body: "잠깐 시간 맞는 친구한테 링크 보내서 모국어 그대로 수다. 영어 못해도 OK.",
    },
    {
      emoji: "🗣️",
      tag: "언어 학습",
      title: "실전 회화 연습",
      body: "원어민과 매칭. 내가 말한 문장이 어떻게 번역되는지 자막으로 즉시 피드백.",
    },
    {
      emoji: "💼",
      tag: "업무",
      title: "다국적 미팅",
      body: "방 만들기 → 링크 공유 → 모두 모국어로 발언. 대화 자동 기록은 회의록 초안.",
    },
  ];

  return (
    <section
      id="how"
      ref={ref}
      style={{
        background: SURFACE_WARM,
        borderTop: `1px solid ${BORDER_SOFT}`,
        borderBottom: `1px solid ${BORDER_SOFT}`,
      }}
    >
      <div style={{ padding: "var(--section-py) var(--section-px)", maxWidth: 1100, margin: "0 auto" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 900,
            textAlign: "center",
            letterSpacing: "-0.03em",
            color: TEXT,
          }}
        >
          이런 때 <span style={{ color: ACCENT }}>써보세요</span>
        </h2>
        <div
          style={{
            marginTop: 44,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {cases.map((c) => (
            <div
              key={c.title}
              data-uc
              style={{
                position: "relative",
                padding: 26,
                background: SURFACE,
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: 16,
                transition: "transform 0.25s, box-shadow 0.25s, border-color 0.25s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow =
                  "0 18px 36px rgba(15,23,42,0.08)";
                e.currentTarget.style.borderColor = ACCENT;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = BORDER_SOFT;
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 14 }}>{c.emoji}</div>
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 9px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: ACCENT_DEEP,
                  background: ACCENT_SOFT,
                  borderRadius: 999,
                  marginBottom: 10,
                }}
              >
                {c.tag}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: TEXT,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {c.title}
              </div>
              <div style={{ fontSize: 13.5, color: TEXT_MUTED, lineHeight: 1.6 }}>
                {c.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── (unused) ────────────────────────────────────────────────────────
function _Unused1() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: titleRef.current, start: "top 80%", once: true },
      });
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll<HTMLDivElement>("[data-card]");
        gsap.from(cards, {
          y: 60,
          opacity: 0,
          scale: 0.95,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: cardsRef.current, start: "top 80%", once: true },
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const items = [
    {
      icon: "🌐",
      title: "실시간 번역",
      desc:
        "OpenAI Realtime API로 말하는 동시에 번역. 토큰 단위로 흘러내려서 거의 동시 통역에 가까운 경험.",
    },
    {
      icon: "🎬",
      title: "P2P 영상 통화",
      desc:
        "WebRTC로 직접 연결. 음성과 영상이 서버를 거치지 않아 지연 낮고 사적인 대화 보장.",
    },
    {
      icon: "📝",
      title: "대화 기록 저장",
      desc: "원문과 번역을 모두 자동 저장. 통화 후 다시 보면서 공부하거나 회의록처럼 활용.",
    },
  ];

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{ padding: "var(--section-py) var(--section-px)", maxWidth: 1200, margin: "0 auto" }}
    >
      <h2
        ref={titleRef}
        style={{
          margin: 0,
          fontSize: "clamp(28px, 4.5vw, 44px)",
          fontWeight: 900,
          textAlign: "center",
          letterSpacing: "-0.03em",
          color: TEXT,
        }}
      >
        뭐가 <span style={{ color: ACCENT }}>다른가요</span>?
      </h2>
      <div
        ref={cardsRef}
        style={{
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        {items.map((it) => (
          <div
            key={it.title}
            data-card
            style={{
              padding: 28,
              background: SURFACE,
              border: `1px solid ${BORDER_SOFT}`,
              borderRadius: 16,
              transition: "border-color 0.25s, transform 0.25s, box-shadow 0.25s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 20px 40px rgba(15,23,42,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER_SOFT;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>{it.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: TEXT, marginBottom: 8 }}>
              {it.title}
            </div>
            <div style={{ fontSize: 14, color: TEXT_MUTED, lineHeight: 1.6 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────
function _Unused2_HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: titleRef.current, start: "top 80%", once: true },
      });

      const steps = sectionRef.current!.querySelectorAll<HTMLDivElement>("[data-step]");
      steps.forEach((step) => {
        const circle = step.querySelector<HTMLElement>("[data-step-circle]");
        const content = step.querySelector<HTMLElement>("[data-step-content]");
        const line = step.querySelector<HTMLElement>("[data-step-line]");
        const tl = gsap.timeline({
          scrollTrigger: { trigger: step, start: "top 75%", once: true },
        });
        if (circle) tl.from(circle, { scale: 0, duration: 0.5, ease: "back.out(1.8)" });
        if (content)
          tl.from(
            content,
            { x: 40, opacity: 0, duration: 0.6, ease: "power3.out" },
            "-=0.3"
          );
        if (line)
          tl.from(line, { scaleY: 0, transformOrigin: "top center", duration: 0.5 }, "<");
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const steps = [
    {
      n: "01",
      title: "언어 선택",
      desc: "내가 할 수 있는 언어와 연습할 언어를 골라요.",
    },
    {
      n: "02",
      title: "매칭 또는 방 만들기",
      desc: "랜덤 매칭으로 즉시 연결되거나, 링크 공유로 친구 초대.",
    },
    {
      n: "03",
      title: "디바이스 점검",
      desc: "들어가기 전 마이크/카메라 미리보기로 준비 완료 확인.",
    },
    {
      n: "04",
      title: "대화 시작",
      desc: "말하는 즉시 자막이 흘러나오고, 대화는 자동 저장돼요.",
    },
  ];

  return (
    <section
      id="how"
      ref={sectionRef}
      style={{
        background: SURFACE_WARM,
        borderTop: `1px solid ${BORDER_SOFT}`,
        borderBottom: `1px solid ${BORDER_SOFT}`,
      }}
    >
      <div style={{ padding: "var(--section-py) var(--section-px)", maxWidth: 880, margin: "0 auto" }}>
        <h2
          ref={titleRef}
          style={{
            margin: 0,
            fontSize: "clamp(28px, 4.5vw, 44px)",
            fontWeight: 900,
            textAlign: "center",
            letterSpacing: "-0.03em",
            color: TEXT,
          }}
        >
          <span style={{ color: ACCENT }}>4단계</span>면 끝.
        </h2>
        <div style={{ marginTop: 60, position: "relative" }}>
          {steps.map((s, i) => (
            <div
              key={s.n}
              data-step
              style={{
                display: "flex",
                gap: 28,
                alignItems: "flex-start",
                position: "relative",
                paddingBottom: i === steps.length - 1 ? 0 : 36,
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  data-step-circle
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: TEXT,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: -0.5,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                  }}
                >
                  {s.n}
                </div>
                {i !== steps.length - 1 && (
                  <div
                    data-step-line
                    style={{
                      position: "absolute",
                      top: 56,
                      left: 27,
                      width: 2,
                      height: "calc(100% - 36px)",
                      backgroundImage:
                        `linear-gradient(${BORDER} 50%, transparent 50%)`,
                      backgroundSize: "2px 8px",
                    }}
                  />
                )}
              </div>
              <div data-step-content style={{ paddingTop: 4, paddingBottom: 12 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: TEXT,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                    fontSize: 14.5,
                    color: TEXT_MUTED,
                    lineHeight: 1.6,
                  }}
                >
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Match Section (existing language pickers + CTAs) ────────────────
function MatchSection() {
  const router = useRouter();
  const { user } = useAuth();
  const isNarrow = useIsNarrow();
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [speaks, setSpeaks] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setSpeaks(p.speaks);
    setWants(p.wants);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        y: 60,
        opacity: 0,
        scale: 0.96,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: cardRef.current, start: "top 80%", once: true },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const pick = (current: string[], setter: (v: string[]) => void, code: string) => {
    // Single-select: tap same code to clear, otherwise replace.
    setter(current[0] === code ? [] : [code]);
  };

  const canMatch = speaks.length > 0 && wants.length > 0;

  const startRandomMatch = () => {
    savePrefs({ speaks, wants });
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent("/match")}`);
      return;
    }
    router.push("/match");
  };

  const startNewRoom = () => {
    savePrefs({ speaks, wants });
    const roomId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const mine = speaks[0] ?? "ko";
    const peer = wants[0] ?? "en";
    const dest = `/call/${roomId}?mine=${mine}&peer=${peer}&host=1`;
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(dest);
  };

  return (
    <section
      id="match"
      ref={sectionRef}
      style={{ padding: "var(--section-py) var(--section-px)", background: PAGE_BG }}
    >
      <div
        ref={cardRef}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: 36,
          background: SURFACE,
          borderRadius: 20,
          border: `1px solid ${BORDER_SOFT}`,
          boxShadow: "0 12px 40px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 11px",
              background: ACCENT_SOFT,
              color: ACCENT_DEEP,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            START
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: -0.5,
              color: TEXT,
            }}
          >
            지금 시작해볼까요?
          </h2>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              color: TEXT_MUTED,
              lineHeight: 1.55,
            }}
          >
            언어를 고르고 매칭 또는 방 만들기를 선택하세요. 가능 언어와 원하는 언어는{" "}
            <strong style={{ color: TEXT }}>각각 1개만</strong> 선택할 수 있어요.
          </p>
        </div>

        <LangSection
          title="내가 할 수 있는 언어 (1개)"
          codes={speaks}
          onPick={(c) => pick(speaks, setSpeaks, c)}
        />
        <LangSection
          title="연습하고 싶은 언어 (1개)"
          codes={wants}
          onPick={(c) => pick(wants, setWants, c)}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
            gap: 10,
            marginTop: 28,
          }}
        >
          <ModeButton
            primary
            disabled={!canMatch || !hydrated}
            onClick={startRandomMatch}
            icon="🎲"
            title="랜덤 매칭"
            subtitle="대기 풀에서 자동 연결"
          />
          <ModeButton
            disabled={!canMatch || !hydrated}
            onClick={startNewRoom}
            icon="🚪"
            title="방 만들기"
            subtitle="링크 공유 · 회의용"
          />
        </div>

        {!canMatch && hydrated && (
          <p
            style={{
              color: TEXT_MUTED,
              marginTop: 12,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            각 줄에서 언어를 하나 이상 선택하면 활성화됩니다.
          </p>
        )}
      </div>
    </section>
  );
}

function ModeButton({
  primary,
  disabled,
  onClick,
  icon,
  title,
  subtitle,
}: {
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) {
  const bg = disabled ? SURFACE_ALT : primary ? ACCENT : SURFACE;
  const color = disabled ? "#9ca3af" : primary ? "white" : TEXT;
  const border = disabled ? BORDER : primary ? ACCENT : BORDER;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "16px 18px",
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        fontSize: 14,
        boxShadow: !disabled && primary ? `0 6px 18px ${ACCENT}50` : "none",
        transition: "transform 0.2s, background 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-2px)";
          if (primary) {
            e.currentTarget.style.background = ACCENT_DEEP;
            e.currentTarget.style.boxShadow = `0 10px 24px ${ACCENT}66`;
          } else {
            e.currentTarget.style.background = ACCENT_SOFT;
          }
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.background = bg;
        if (primary) e.currentTarget.style.boxShadow = `0 6px 18px ${ACCENT}50`;
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 3 }}>{subtitle}</div>
    </button>
  );
}

function LangSection({
  title,
  codes,
  onPick,
}: {
  title: string;
  codes: string[];
  onPick: (code: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          color: TEXT_MUTED,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {LANGUAGES.map((l) => {
          const selected = codes.includes(l.code);
          return (
            <button
              key={l.code}
              onClick={() => onPick(l.code)}
              style={{
                padding: "8px 14px",
                background: selected ? ACCENT : SURFACE,
                color: selected ? "white" : TEXT,
                border: `1px solid ${selected ? ACCENT : BORDER}`,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                transition: "all 0.15s",
                boxShadow: selected ? `0 2px 6px ${ACCENT}50` : "none",
              }}
              onMouseEnter={(e) => {
                if (!selected) {
                  e.currentTarget.style.background = ACCENT_SOFT;
                  e.currentTarget.style.borderColor = ACCENT;
                }
              }}
              onMouseLeave={(e) => {
                if (!selected) {
                  e.currentTarget.style.background = SURFACE;
                  e.currentTarget.style.borderColor = BORDER;
                }
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

// ─── FAQ ─────────────────────────────────────────────────────────────
function FAQ() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: titleRef.current, start: "top 80%", once: true },
      });
      if (listRef.current) {
        const items = listRef.current.querySelectorAll<HTMLDivElement>("[data-faq]");
        gsap.from(items, {
          y: 30,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: listRef.current, start: "top 80%", once: true },
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const items = [
    {
      q: "번역이 얼마나 정확해요?",
      a: "OpenAI Realtime API + gpt-4o-transcribe 조합. 짧은 대화는 거의 완벽하고, 가끔 어긋난 번역은 채팅 버블의 ⋯ 메뉴에서 재번역할 수 있어요.",
    },
    {
      q: "데이터는 안전한가요?",
      a: "음성/영상은 P2P (WebRTC)로 직접 흘러서 서버를 거치지 않아요. 대화 기록은 Firestore 보안 규칙으로 본인만 접근 가능.",
    },
    {
      q: "유료인가요?",
      a: "지금 베타라 무료. 회의 녹화·회의록 자동 분석 같은 추가 기능은 이후 유료로 들어와요. 기본 통화·번역은 계속 무료 유지 계획.",
    },
  ];

  return (
    <section
      id="faq"
      ref={sectionRef}
      style={{ padding: "var(--section-py) var(--section-px)", maxWidth: 820, margin: "0 auto" }}
    >
      <h2
        ref={titleRef}
        style={{
          margin: 0,
          fontSize: "clamp(28px, 4.5vw, 44px)",
          fontWeight: 900,
          textAlign: "center",
          letterSpacing: "-0.03em",
          color: TEXT,
        }}
      >
        자주 묻는 <span style={{ color: ACCENT }}>질문</span>
      </h2>
      <div ref={listRef} style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => {
          const open = openIndex === i;
          return (
            <div
              key={i}
              data-faq
              style={{
                background: SURFACE,
                border: `1px solid ${open ? ACCENT : BORDER_SOFT}`,
                borderRadius: 14,
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}
            >
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{it.q}</span>
                <span
                  style={{
                    fontSize: 22,
                    color: open ? ACCENT : TEXT_MUTED,
                    transition: "transform 0.25s",
                    transform: open ? "rotate(45deg)" : "rotate(0)",
                    display: "inline-block",
                    fontWeight: 300,
                    lineHeight: 1,
                  }}
                >
                  +
                </span>
              </button>
              <div
                style={{
                  maxHeight: open ? 400 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.35s ease",
                }}
              >
                <div
                  style={{
                    padding: "0 22px 18px",
                    fontSize: 13.5,
                    color: TEXT_MUTED,
                    lineHeight: 1.65,
                  }}
                >
                  {it.a}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────
function _Unused3_FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(contentRef.current, {
        y: 60,
        opacity: 0,
        scale: 0.92,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: contentRef.current, start: "top 85%", once: true },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        background: DARK_BG,
        color: "white",
        padding: "var(--section-py) var(--section-px)",
        textAlign: "center",
      }}
    >
      <div ref={contentRef} style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
          }}
        >
          말 한마디로<br />
          <span style={{ color: ACCENT }}>세계가 연결돼요.</span>
        </h2>
        <p
          style={{
            margin: "18px auto 0",
            maxWidth: 480,
            fontSize: 16,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.55,
          }}
        >
          준비되셨나요? 무료로 지금 바로 시작하세요.
        </p>
        <div style={{ marginTop: 32 }}>
          <a
            href="#match"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              background: ACCENT,
              color: "white",
              border: `1px solid ${ACCENT}`,
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: `0 6px 24px ${ACCENT}80`,
            }}
          >
            지금 시작하기 →
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${BORDER_SOFT}`,
        padding: "32px 24px",
        background: PAGE_BG,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            h
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>hithere</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_MUTED }}>
            © 2026 hithere — 실시간 번역 영상 통화
          </span>
          <a
            href="https://github.com/tomaho1756"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: TEXT_MUTED,
              textDecoration: "none",
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.04)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 3 1.4 3.7 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
            </svg>
            Made by <strong style={{ fontWeight: 700, color: TEXT }}>@tomaho1756</strong> 김의현
          </a>
        </div>
      </div>
    </footer>
  );
}
