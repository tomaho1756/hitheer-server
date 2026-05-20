import Link from "next/link";

const TEXT = "#18191a";
const TEXT_MUTED = "#65676b";
const SURFACE = "#ffffff";

export const metadata = {
  title: "이용약관 · hithere",
  description: "hithere 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main
      style={{
        background: SURFACE,
        minHeight: "100vh",
        padding: "60px 20px 80px",
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          color: TEXT,
          lineHeight: 1.7,
          fontSize: 14.5,
        }}
      >
        <Link
          href="/"
          style={{ color: TEXT_MUTED, textDecoration: "none", fontSize: 13 }}
        >
          ← 홈으로
        </Link>
        <h1
          style={{
            margin: "16px 0 8px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: -0.4,
          }}
        >
          이용약관
        </h1>
        <p style={{ color: TEXT_MUTED, fontSize: 12.5, marginBottom: 28 }}>
          최종 업데이트: 2026-05-20
        </p>

        <H>1. 서비스 소개</H>
        <p>
          hithere(이하 “서비스”)는 실시간 번역 영상 통화 기능을 제공하는 웹 서비스입니다. 본 약관은 서비스
          이용과 관련한 회원(이하 “이용자”)과 서비스 제공자(@tomaho1756, 이하 “운영자”) 사이의 권리·의무를
          규정합니다.
        </p>

        <H>2. 약관의 효력 및 변경</H>
        <p>
          본 약관은 서비스 화면에 게시함으로써 효력이 발생하며, 운영자는 필요한 경우 약관을 변경할 수
          있습니다. 변경된 약관은 적용일 7일 이전(이용자에게 불리한 변경은 30일 이전)에 공지하며, 이용자가
          명시적으로 거부 의사를 표시하지 않고 서비스를 계속 이용할 경우 변경 약관에 동의한 것으로 봅니다.
        </p>

        <H>3. 회원가입 및 계정</H>
        <ul>
          <li>이용자는 이메일 또는 Google 계정으로 가입할 수 있습니다.</li>
          <li>이용자는 자신의 계정과 비밀번호를 관리할 책임이 있습니다.</li>
          <li>운영자는 약관에 위반되거나 부정한 사용이 확인된 계정을 사전 통지 후 정지할 수 있습니다.</li>
        </ul>

        <H>4. 유료 서비스 및 결제</H>
        <ul>
          <li>
            서비스는 Free / Pro / Professional 등 복수의 요금제를 제공하며, 자세한 내용은{" "}
            <Link href="/pricing" style={{ color: "#02a949" }}>
              요금제 페이지
            </Link>
            에서 확인할 수 있습니다.
          </li>
          <li>결제 처리는 결제대행사(Stripe)를 통해 이루어지며, 결제 수단 정보는 운영자가 보관하지 않습니다.</li>
          <li>
            유료 결제는 월 단위로 자동 갱신되며, 이용자는 언제든 Billing Portal에서 해지할 수 있습니다.
            해지 시 다음 결제일에 갱신이 중단되며, 잔여 기간 동안은 유료 기능이 유지됩니다.
          </li>
          <li>
            서비스 이용 중 발생한 데이터(예: 통화 시간, OpenAI Realtime API 호출량)는 사용량 산정에 활용될
            수 있습니다.
          </li>
        </ul>

        <H>5. 환불 정책</H>
        <p>
          이미 결제된 월 구독은 원칙적으로 환불되지 않으나, 결제 오류·서비스 중대한 장애 등 합리적 사유가
          있는 경우 개별 검토 후 환불할 수 있습니다.
        </p>

        <H>6. 이용자의 의무</H>
        <ul>
          <li>이용자는 통화 상대방의 동의 없이 통화 내용을 외부에 공개하지 않아야 합니다.</li>
          <li>
            타인의 권리를 침해하거나 법령에 위반되는 콘텐츠를 전송·녹화·번역하는 행위는 금지됩니다.
          </li>
          <li>API 남용·자동화된 부정 사용 시 계정이 정지될 수 있습니다.</li>
        </ul>

        <H>7. 면책</H>
        <p>
          운영자는 OpenAI API, Firebase, Stripe, coturn 등 제3자 서비스의 장애로 인한 손해에 대해 책임을
          지지 않습니다. 또한 자동 번역의 정확성은 보증되지 않으며, 중요한 의사결정의 근거로 사용 시
          이용자가 결과를 검증해야 합니다.
        </p>

        <H>8. 분쟁 해결</H>
        <p>
          본 약관과 관련된 분쟁은 대한민국 법령을 따르며, 서울중앙지방법원을 1심 관할로 합니다.
        </p>

        <H>9. 문의</H>
        <p>
          서비스 관련 문의: <a href="https://github.com/tomaho1756" style={{ color: "#02a949" }}>github.com/tomaho1756</a>
        </p>
      </article>
    </main>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "26px 0 8px",
        fontSize: 16,
        fontWeight: 800,
        color: TEXT,
        letterSpacing: -0.2,
      }}
    >
      {children}
    </h2>
  );
}
