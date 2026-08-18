import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mtcc-uae.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
  description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings, tournament rules and championship updates.",
  openGraph: {
    title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
    description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings, tournament rules and championship updates.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary",
    title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
    description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings and rules.",
    images: ["/logo.png"],
  },
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
