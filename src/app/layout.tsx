import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maharashtra Tennis Cricket Championship UAE",
  description: "Official tournament management platform — MTCC UAE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
