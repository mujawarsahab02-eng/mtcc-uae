import Link from "next/link";
import { SEASON1 } from "@/lib/season";

// Shown on the homepage once Season 1 is over, in place of the match-day countdown.
export default function ChampionsBanner() {
  return (
    <div className="fade-up relative w-full max-w-3xl mx-auto rounded-[20px] overflow-hidden mb-8" style={{ padding: 1 }}>
      <div className="hud-spin-layer absolute inset-[-100%]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, #D4AF37 16deg, transparent 55deg, transparent 180deg, #FF7A3D 200deg, transparent 240deg, transparent 360deg)" }} />
      <div className="relative rounded-[19px] px-4 sm:px-8 py-7 text-center overflow-hidden" style={{ background: "linear-gradient(180deg,#0B1226,#070B16)" }}>
        <div className="font-mono text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.28em] text-goldBright mb-3">Season 1 Complete · {SEASON1.date}</div>
        <div className="text-4xl mb-1" aria-hidden>🏆</div>
        <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-1">Champions</div>
        <div className="font-display font-black text-3xl sm:text-5xl text-goldBright tracking-wide" style={{ textShadow: "0 0 24px rgba(240,201,74,.6)" }}>{SEASON1.champion}</div>
        <div className="text-sm text-white/70 mt-3">Runners-up: <span className="font-semibold text-white">{SEASON1.runnerUp}</span></div>
        <div className="text-xs text-white/45 mt-1">{SEASON1.teams} teams · {SEASON1.matches} matches · {SEASON1.venue}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link href="/matches" className="text-orange hover:underline">See all results →</Link>
          <Link href="/gallery" className="text-orange hover:underline">Season 1 gallery →</Link>
        </div>
      </div>
    </div>
  );
}
