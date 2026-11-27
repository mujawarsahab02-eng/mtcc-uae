import Link from "next/link";
import { SEASON1 } from "@/lib/season";

// Shown on the homepage once Season 1 is over, in place of the match-day countdown.
export default function ChampionsBanner() {
  return (
    <div className="fade-up relative w-full max-w-5xl mx-auto rounded-[20px] overflow-hidden mb-8" style={{ padding: 1 }}>
      <div className="hud-spin-layer absolute inset-[-100%]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, #D4AF37 16deg, transparent 55deg, transparent 180deg, #FF7A3D 200deg, transparent 240deg, transparent 360deg)" }} />
      <div className="relative rounded-[19px] px-3 sm:px-6 pt-6 pb-6 overflow-hidden" style={{ background: "linear-gradient(180deg,#0B1226,#070B16)" }}>
        <div className="text-center font-mono text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.28em] text-goldBright mb-4">
          Season 1 Complete · {SEASON1.date}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 items-start">
          {/* Champions */}
          <figure className="rounded-xl overflow-hidden" style={{ border: "2px solid #D4AF37", boxShadow: "0 0 30px rgba(212,175,55,.35)" }}>
            <img src="/season1/champions.jpg" alt={`${SEASON1.champion}, MTCC Season 1 champions`} className="block w-full h-auto" style={{ aspectRatio: "15 / 8" }} />
            <figcaption className="px-4 py-3 text-left" style={{ background: "linear-gradient(90deg,#1c1503,#0B1226)" }}>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-goldBright font-bold">🏆 Champions</div>
              <div className="font-display font-black text-2xl sm:text-3xl text-white leading-tight">{SEASON1.champion}</div>
            </figcaption>
          </figure>

          {/* Runners-up */}
          <figure className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.25)" }}>
            <img src="/season1/runner-up.jpg" alt={`${SEASON1.runnerUp}, MTCC Season 1 runners-up`} className="block w-full h-auto" style={{ aspectRatio: "15 / 8" }} />
            <figcaption className="px-4 py-3 text-left" style={{ background: "#0B1226" }}>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/70 font-bold">Runners-up</div>
              <div className="font-display font-black text-2xl sm:text-3xl text-white leading-tight">{SEASON1.runnerUp}</div>
            </figcaption>
          </figure>
        </div>

        <div className="text-xs text-white/45 mt-4 text-center">{SEASON1.teams} teams · {SEASON1.matches} matches · {SEASON1.venue}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link href="/matches" className="text-orange hover:underline">See all results →</Link>
          <Link href="/gallery" className="text-orange hover:underline">Season 1 gallery →</Link>
        </div>
      </div>
    </div>
  );
}
