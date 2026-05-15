import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hithere",
  description: "Random language-exchange video calls",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
