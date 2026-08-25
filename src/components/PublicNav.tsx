"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import InstallAppButton from "@/components/InstallAppButton";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/squads", label: "Squads" },
  { href: "/standings", label: "Standings" },
  { href: "/rules", label: "Rules" },
  { href: "/#sponsors", label: "Sponsors" },
];

export default function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 bg-warmWhite/95 backdrop-blur-md border-b border-black/5 shadow-sm">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gold/60 bg-white shrink-0">
            <Logo className="w-full h-full" />
          </div>
          <span className="font-display font-bold text-sm tracking-wide text-navyText hidden sm:inline">MTCC U.A.E.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ color: active ? "#0B1F3A" : "#566274" }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <InstallAppButton className="hidden sm:inline-flex items-center px-4 py-2.5 rounded-full text-sm font-semibold border border-black/10 text-navyText transition-colors hover:bg-black/5" />
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center px-5 py-2.5 rounded-full text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}
          >
            Register Now
          </Link>
          <button
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center border border-black/10"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className="text-navyText text-lg">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-black/5 bg-warmWhite px-5 py-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-semibold border-b border-black/5 last:border-0"
              style={{ color: "#152238" }}
            >
              {l.label}
            </Link>
          ))}
          <InstallAppButton className="block w-full text-center mt-3 px-5 py-3 rounded-full text-sm font-semibold border border-black/10 text-navyText" />
          <Link
            href="/register"
            onClick={() => setOpen(false)}
            className="block text-center mt-3 px-5 py-3 rounded-full text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}
          >
            Register Now
          </Link>
        </div>
      )}
    </div>
  );
}
