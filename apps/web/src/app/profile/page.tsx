"use client";

import Link from "next/link";

import { MobileProfile } from "@/components/mobile/profile";

export default function ProfilePage() {
  return (
    <>
      <div className="app-mobile-only">
        <MobileProfile />
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>프로필은 모바일에서</h1>
        <p style={{ marginTop: 10, color: "#65676b", fontSize: 14 }}>
          데스크탑에서는 우상단의 계정 메뉴를 사용해주세요.
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
