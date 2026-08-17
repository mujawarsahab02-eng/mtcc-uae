"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui";
import Logo from "@/components/Logo";
import type { UserRole } from "@/lib/constants";

const NAV: { href: string; label: string; icon: string; roles?: UserRole[] }[] = [
  { href: "/admin", label: "Dashboard", icon: "▦" },
  { href: "/admin/settings", label: "Tournament Settings", icon: "⚙" },
  { href: "/admin/players", label: "Players", icon: "☰" },
  { href: "/admin/teams", label: "Teams", icon: "◆" },
  { href: "/admin/segregation", label: "Segregation", icon: "▤" },
  { href: "/admin/auction", label: "Live Auction", icon: "⚡" },
  { href: "/admin/squads", label: "Team Squads", icon: "🏆" },
  { href: "/admin/sponsors", label: "Sponsors", icon: "🤝" },
  { href: "/admin/fixtures", label: "Fixtures & Results", icon: "📅" },
  { href: "/admin/users", label: "User & Roles", icon: "👤", roles: ["Super Admin"] },
  { href: "/admin/audit", label: "Audit Log", icon: "🛡", roles: ["Super Admin"] },
];

export default function Sidebar({ role, fullName }: { role: UserRole; fullName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const visibleNav = NAV.filter((n) => !n.roles || n.roles.includes(role));

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-line">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 border-2 border-gold bg-bgCard overflow-hidden">
          <Logo className="w-full h-full" />
        </div>
        <div className="text-sm font-bold leading-snug mt-0.5 font-display">{fullName || "MTCC UAE Admin"}</div>
        <div className="mt-2"><Badge tone="blue">{role}</Badge></div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: active ? "rgba(212,175,55,0.12)" : "transparent",
                color: active ? "#F0C94A" : "#8B98B5",
                borderLeft: active ? "2px solid #D4AF37" : "2px solid transparent",
              }}
            >
              <span className="opacity-80">{n.icon}</span> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-line space-y-1">
        {role === "Team Owner" && (
          <Link href="/team" className="block w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-blue">
            My Team Dashboard ↗
          </Link>
        )}
        <Link href="/register" className="block w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-blue">
          Open Registration Page ↗
        </Link>
        <button onClick={signOut} className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-mutedDim">
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 border-r border-line shrink-0 bg-bgPanel">{content}</aside>
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 border-b border-line bg-bgPanel">
        <button onClick={() => setOpen(true)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-bgCard">☰</button>
        <div className="text-sm font-bold text-gold font-display">MTCC UAE</div>
        <div className="w-9 h-9" />
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex" onClick={() => setOpen(false)}>
          <div className="w-64 h-full border-r border-line bg-bgPanel" onClick={(e) => e.stopPropagation()}>{content}</div>
          <div className="flex-1 bg-black/60" />
        </div>
      )}
    </>
  );
}
