"use client";

import Link from "next/link";

import { MobilePromo } from "@/components/mobile/promo";

export default function AboutPage() {
  return (
    <>
      <div className="app-mobile-only">
        <MobilePromo />
      </div>
      <main
        className="app-desktop-only"
        style={{
          maxWidth: 540,
          margin: "20vh auto",
          padding: 32,
          textAlign: "center",
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>이 페이지는 모바일 전용이에요</h1>
        <p style={{ marginTop: 10, color: "#65676b", fontSize: 14 }}>
          데스크탑에서는 메인 랜딩에서 같은 내용을 보실 수 있어요.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "10px 22px",
            background: "#03C75A",
            color: "white",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          홈으로 →
        </Link>
      </main>
    </>
  );
}
