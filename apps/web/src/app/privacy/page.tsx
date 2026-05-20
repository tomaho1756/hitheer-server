import Link from "next/link";

const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const SURFACE = "#ffffff";

export const metadata = {
  title: "개인정보처리방침 · hithere",
  description: "hithere 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main style={{ background: SURFACE, minHeight: "100vh", padding: "60px 20px 80px" }}>
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          color: TEXT,
          lineHeight: 1.7,
          fontSize: 14.5,
        }}
      >
        <Link href="/" style={{ color: TEXT_MUTED, textDecoration: "none", fontSize: 13 }}>
          ← 홈으로
        </Link>
        <h1 style={{ margin: "16px 0 8px", fontSize: 28, fontWeight: 900, letterSpacing: -0.4 }}>
          개인정보처리방침
        </h1>
        <p style={{ color: TEXT_MUTED, fontSize: 12.5, marginBottom: 28 }}>
          최종 업데이트: 2026-05-20
        </p>

        <H>1. 수집하는 개인정보</H>
        <p>운영자는 서비스 제공을 위해 다음 항목을 수집·이용합니다.</p>
        <ul>
          <li>
            <strong>회원가입 시</strong>: 이메일 주소, 표시 이름, 프로필 이미지 URL, Firebase UID
          </li>
          <li>
            <strong>서비스 이용 시</strong>: 선호 언어 설정, 통화 시작/종료 시각, 통화 원문/번역 텍스트,
            통화 참여자 식별자, IP 주소(보안 목적 일시 보관)
          </li>
          <li>
            <strong>결제 시</strong>: Stripe customer ID, subscription ID, 결제 상태, 결제 이력
            (카드번호 등 결제수단 자체는 Stripe가 보관하며 운영자는 접근하지 않음)
          </li>
        </ul>

        <H>2. 개인정보의 이용 목적</H>
        <ul>
          <li>회원 식별 및 본인 확인</li>
          <li>실시간 번역, 통화 매칭, 친구 기능 제공</li>
          <li>요금제별 사용량 산정 및 결제 처리</li>
          <li>서비스 개선을 위한 통계 분석 (개별 식별이 불가능한 형태로만)</li>
          <li>약관 위반·부정 사용 대응</li>
        </ul>

        <H>3. 보관 기간</H>
        <ul>
          <li>회원 정보: 회원 탈퇴 시 즉시 삭제 (단, 관련 법령상 보관이 요구되는 경우 해당 기간까지)</li>
          <li>통화 원문/번역 기록: 사용자가 직접 삭제하거나 회원 탈퇴 시 함께 삭제</li>
          <li>결제 기록: 전자상거래법에 따라 5년 보관</li>
        </ul>

        <H>4. 제3자 처리 위탁</H>
        <p>서비스 운영을 위해 다음 위탁업체에 개인정보의 일부가 전달됩니다.</p>
        <ul>
          <li>
            <strong>Firebase (Google LLC)</strong>: 인증, 데이터베이스(Firestore), 호스팅
          </li>
          <li>
            <strong>OpenAI, L.L.C.</strong>: 통화 음성 → 텍스트 변환 및 번역 생성 (Realtime API)
          </li>
          <li>
            <strong>Stripe, Inc.</strong>: 구독 결제 처리 및 청구
          </li>
          <li>
            <strong>Google Cloud Platform</strong>: 시그널링 서버(Cloud Run), TURN 서버(GCE) 호스팅
          </li>
        </ul>
        <p style={{ fontSize: 13, color: TEXT_MUTED }}>
          위 업체는 각자의 개인정보 처리 정책을 따르며, 운영자는 위탁 목적 외의 이용을 금지합니다.
        </p>

        <H>5. 이용자의 권리</H>
        <ul>
          <li>본인의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</li>
          <li>회원 탈퇴 시 모든 개인정보가 삭제됩니다 (법령상 보관 의무가 있는 항목 제외).</li>
          <li>마케팅 정보 수신 동의는 언제든 철회할 수 있습니다.</li>
        </ul>

        <H>6. 보안</H>
        <ul>
          <li>인증 토큰은 Firebase Authentication을 통해 RS256으로 서명·검증됩니다.</li>
          <li>Firestore 보안 규칙으로 본인 데이터에만 접근 가능합니다.</li>
          <li>WebRTC 영상/음성은 P2P 또는 TURN을 통해 전송되며 운영자 서버에 저장되지 않습니다.</li>
          <li>HTTPS / WSS 전 구간 암호화</li>
        </ul>

        <H>7. 문의</H>
        <p>
          개인정보 관련 문의:{" "}
          <a href="https://github.com/tomaho1756" style={{ color: "#02a949" }}>
            github.com/tomaho1756
          </a>
        </p>

        <p style={{ marginTop: 36, fontSize: 12.5, color: TEXT_MUTED }}>
          본 방침은 적용일 이후 변경 시 사전 공지합니다. 변경 이력은 이 페이지 상단의 “최종 업데이트”
          날짜로 확인할 수 있습니다.
        </p>
      </article>
    </main>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: "26px 0 8px", fontSize: 16, fontWeight: 800, color: TEXT, letterSpacing: -0.2 }}>
      {children}
    </h2>
  );
}
