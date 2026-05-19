"use client";

// Mobile app shell — top header + content area + bottom tab bar.
// Rendered for viewports ≤768px. Desktop is unaffected.

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { AccountPill } from "@/lib/account-pill";

const T = {
  bg: "#f6f7fa",
  surface: "#ffffff",
  surfaceAlt: "#f1f3f5",
  text: "#18191a",
  textMuted: "#65676b",
  textFaint: "#9ca3af",
  accent: "#03C75A",
  accentDeep: "#02a949",
  accentSoft: "#e8f8ee",
};

const HEADER_H = 62;
const TABBAR_H = 64;

export interface TabDef {
  href: string;
  label: string;
  Icon: (p: { active: boolean }) => React.JSX.Element;
}

export const TABS: TabDef[] = [
  { href: "/", label: "매칭", Icon: HomeIcon },
  { href: "/history", label: "기록", Icon: HistoryIcon },
  { href: "/about", label: "소개", Icon: SparkleIcon },
  { href: "/profile", label: "프로필", Icon: PersonIcon },
];

export function MobileFrame({
  title,
  children,
  showTabs = true,
  hideHeader = false,
  contentBg,
}: {
  title?: string;
  children: ReactNode;
  showTabs?: boolean;
  hideHeader?: boolean;
  contentBg?: string;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: contentBg ?? T.bg,
        color: T.text,
      }}
    >
      {!hideHeader && <MobileHeader title={title} />}
      <main
        style={{
          flex: 1,
          paddingTop: hideHeader ? 0 : HEADER_H,
          paddingBottom: showTabs ? TABBAR_H : 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>
      {showTabs && <BottomTabs />}
    </div>
  );
}

function MobileHeader({ title }: { title?: string }) {
  const pageTitle = title && title !== "hithere" ? title : null;
  return (
    <header
      className="app-safe-top"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_H,
        zIndex: 50,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.86) 100%)",
        backdropFilter: "saturate(160%) blur(18px)",
        WebkitBackdropFilter: "saturate(160%) blur(18px)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: T.accent,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 14,
            boxShadow: `0 2px 6px ${T.accent}55`,
            flexShrink: 0,
          }}
        >
          h
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            lineHeight: 1.1,
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: -0.3,
              color: T.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            hithere
          </span>
          <span
            style={{
              marginTop: 2,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: pageTitle ? T.accentDeep : T.textMuted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {pageTitle ?? "Realtime translate"}
          </span>
        </div>
      </div>
      <AccountPill returnTo="/" />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(3,199,90,0.18) 50%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </header>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  };
  return (
    <nav
      className="app-safe-bottom"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: TABBAR_H,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 -1px 0 rgba(15,23,42,0.06)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-around",
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="mobile-tab-btn"
            data-active={active}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: active ? T.accent : T.textMuted,
              padding: "10px 0 6px",
              fontFamily: "inherit",
              position: "relative",
              transition: "color 0.22s",
            }}
          >
            <span
              className="mobile-tab-icon"
              data-active={active}
              style={{
                display: "inline-flex",
                transition:
                  "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s",
                transform: active ? "translateY(-2px) scale(1.08)" : "translateY(0) scale(1)",
              }}
            >
              <tab.Icon active={active} />
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: active ? 700 : 500,
                letterSpacing: -0.1,
                opacity: active ? 1 : 0.85,
                transition: "opacity 0.22s, font-weight 0.22s",
              }}
            >
              {tab.label}
            </span>
            {/* Active pill behind the icon */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 6,
                width: 36,
                height: 4,
                borderRadius: 2,
                background: T.accent,
                opacity: active ? 1 : 0,
                transform: active ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "center",
                transition:
                  "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}

// ─── Tab icons ───────────────────────────────────────────────────────
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.15 : 0}
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
function SparkleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12" />
      <circle cx="12" cy="12" r="3.5" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}
function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}
