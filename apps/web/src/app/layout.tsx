import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { InvitationListener } from "@/components/invitation-listener";

export const metadata: Metadata = {
  title: "hithere",
  description: "Random language-exchange video calls",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          <InvitationListener />
        </AuthProvider>
      </body>
    </html>
  );
}
