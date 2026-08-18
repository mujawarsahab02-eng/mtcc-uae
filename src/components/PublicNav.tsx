"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/register", label: "Register" },
  { href: "/standings", label: "Standings" },
  { href: "/squads", label: "Squads" },
  { href: "/rules", label: "Rules" },
];

export default function PublicNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 border-b border-line backdrop-blur-md" style={{ background: "rgba(10,15,28,0.75)" }}>
      <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-gold/50 bg-bgCard shrink-0">
            <Logo className="w-full h-full" />
          </div>
          <span className="font-display font-bold text-sm tracking-wide hidden sm:inline">MTCC UAE</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
                style={{ color: active ? "#F0C94A" : "#8B98B5", background: active ? "rgba(212,175,55,0.1)" : "transparent" }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
