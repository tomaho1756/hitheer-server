"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { LANGUAGES, loadPrefs, savePrefs } from "@/lib/languages";
import { AccountPill } from "@/lib/account-pill";

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
    <div style={{ background: PAGE_BG, overflowX: "hidden" }}>
      <NavBar />
      <Hero />
      <Intro />
      <Features />
      <HowItWorks />
      <MatchSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── NavBar ──────────────────────────────────────────────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
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

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <NavLink href="#features" color={scrolled ? TEXT_MUTED : "rgba(255,255,255,0.8)"}>
            기능
          </NavLink>
          <NavLink href="#how" color={scrolled ? TEXT_MUTED : "rgba(255,255,255,0.8)"}>
            사용법
          </NavLink>
          <NavLink href="/history" color={scrolled ? TEXT_MUTED : "rgba(255,255,255,0.8)"}>
            기록
          </NavLink>
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

      // Parallax fade-out as the section scrolls past.
      if (sectionRef.current) {
        gsap.to(
          [line1Ref.current, line2Ref.current, subRef.current, ctaRef.current, badgeRef.current],
          {
            y: -120,
            opacity: 0,
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
          zIndex: 0,
        }}
      >
        <source src="/hero_video.mp4" type="video/mp4" />
      </video>
      {/* ── Layer A: cutout headlines (multiply over the video) ──
          The medium-gray bg dims the video everywhere; the text itself,
          rendered white / soft-green inside this layer, multiplies back to
          near-original video color so the text shape acts as a "window".
          Tuned so the dim is noticeable but the surroundings aren't muddy. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#3a3a3a",
          mixBlendMode: "multiply",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          pointerEvents: "none",
        }}
      >
        <Spacer height={50} />
        <h1
          ref={line1Ref}
          data-text="ANY LANGUAGE,"
          style={{
            margin: 0,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontSize: "clamp(56px, 13vw, 200px)",
            color: "white",
            textAlign: "center",
          }}
        >
          ANY LANGUAGE,
        </h1>
        <h1
          ref={line2Ref}
          data-text="ONE CALL."
          style={{
            margin: 0,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontSize: "clamp(56px, 13vw, 200px)",
            // Soft green: multiplied with bright video gives a translucent
            // green tint rather than a solid green block.
            color: "#a8e0bb",
            textAlign: "center",
          }}
        >
          ONE CALL.
        </h1>
        <Spacer height={220} />
      </div>

      {/* ── Layer B: regular UI (no blend) ──
          Mirrors the layout but with invisible spacers in the headline slots
          so the badge / subtitle / CTAs land in the right vertical positions. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <div
          ref={badgeRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 13px",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            color: "white",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          ⚡ Powered by OpenAI Realtime
        </div>

        {/* Invisible placeholders matching the headlines so the rest of the UI
            lines up under the cutout text. */}
        <h1
          aria-hidden
          style={{
            margin: 0,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontSize: "clamp(56px, 13vw, 200px)",
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          ANY LANGUAGE,
        </h1>
        <h1
          aria-hidden
          style={{
            margin: 0,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontSize: "clamp(56px, 13vw, 200px)",
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          ONE CALL.
        </h1>

        <p
          ref={subRef}
          style={{
            margin: "30px auto 0",
            maxWidth: 580,
            fontSize: 17,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          }}
        >
          전 세계 누구와도 모국어 그대로 대화하세요. 말하는 즉시 상대방 언어로 번역돼 자막으로
          뜨고, 대화 기록은 자동 저장돼요.
        </p>

        <div
          ref={ctaRef}
          style={{
            marginTop: 30,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
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
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            사용법 보기
          </a>
        </div>
      </div>

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
        padding: "120px 24px 100px",
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

// ─── Features ────────────────────────────────────────────────────────
function Features() {
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
      style={{ padding: "120px 24px", maxWidth: 1200, margin: "0 auto" }}
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
function HowItWorks() {
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
      <div style={{ padding: "120px 24px", maxWidth: 880, margin: "0 auto" }}>
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

  const toggle = (list: string[], setList: (v: string[]) => void, code: string) => {
    setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  const canMatch = speaks.length > 0 && wants.length > 0;

  const startRandomMatch = () => {
    savePrefs({ speaks, wants });
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
    router.push(`/call/${roomId}?mine=${mine}&peer=${peer}&host=1`);
  };

  return (
    <section
      id="match"
      ref={sectionRef}
      style={{ padding: "120px 24px", background: PAGE_BG }}
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
            언어를 고르고 매칭 또는 방 만들기를 선택하세요.
          </p>
        </div>

        <LangSection
          title="내가 할 수 있는 언어"
          codes={speaks}
          toggle={(c) => toggle(speaks, setSpeaks, c)}
        />
        <LangSection
          title="연습하고 싶은 언어"
          codes={wants}
          toggle={(c) => toggle(wants, setWants, c)}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
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
  toggle,
}: {
  title: string;
  codes: string[];
  toggle: (code: string) => void;
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
              onClick={() => toggle(l.code)}
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
      q: "번역 정확도는 어느 정도예요?",
      a: "OpenAI Realtime API (gpt-realtime)와 gpt-4o-transcribe를 씁니다. 짧고 명확한 대화는 거의 완벽하고, 긴 문장도 의미 보존이 좋아요. 가끔 어긋난 번역은 채팅 버블의 ⋯ 메뉴에서 재번역할 수 있어요.",
    },
    {
      q: "통화 내용이 저장되나요?",
      a: "로그인 사용자는 Firestore에 자기 계정 하위 트리에만 저장돼요. 로그인 안 한 경우는 서버 측 SQLite (휘발성)에 임시 저장. 자기 자신만 볼 수 있고, /기록 페이지에서 다시 볼 수 있어요.",
    },
    {
      q: "데이터는 안전한가요?",
      a: "P2P 음성/영상은 WebRTC로 직접 연결돼 서버를 거치지 않아요. 시그널링과 번역은 HTTPS/WSS 암호화. 대화 기록은 Firestore 보안 규칙으로 본인만 접근 가능.",
    },
    {
      q: "유료인가요?",
      a: "지금은 베타라 무료. 추후 회의 녹화·회의록 분석 같은 고급 기능은 유료(Stripe)로 갈 예정. 기본 통화·번역은 계속 무료로 유지할 계획.",
    },
    {
      q: "친구랑 직접 통화할 수 있나요?",
      a: "지금은 \"방 만들기\"로 링크 만들어서 공유하는 방식. 친구 추가/직접 전화 걸기 기능은 다음 업데이트에 들어옵니다.",
    },
  ];

  return (
    <section
      id="faq"
      ref={sectionRef}
      style={{ padding: "120px 24px", maxWidth: 820, margin: "0 auto" }}
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
function FinalCTA() {
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
        padding: "120px 24px",
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
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          © 2026 hithere — 실시간 번역 영상 통화
        </div>
      </div>
    </footer>
  );
}
