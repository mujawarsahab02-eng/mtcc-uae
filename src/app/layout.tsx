import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mtccuae.com";

export const viewport: Viewport = {
  themeColor: "#0A0F1C",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
  description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings, tournament rules and championship updates.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MTCC UAE",
  },
  openGraph: {
    title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
    description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings, tournament rules and championship updates.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maharashtra Tennis Cricket Championship U.A.E. | MTCC UAE",
    description: "Official Maharashtra Tennis Cricket Championship U.A.E. website — player registration, auction, teams, standings and rules.",
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink min-h-screen">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
