"use client";

import { useEffect, useState } from "react";

// Futuristic match-day countdown for the homepage hero.
// `date` is the tournament date (YYYY-MM-DD); reporting/start time is 7:00 am Dubai time.
export default function HeroCountdown({ date, venue, since = "2026-10-04" }: { date: string | null | undefined; venue?: string | null; since?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!date || now === null) return null;
  const target = new Date(`${date.slice(0, 10)}T07:00:00+04:00`).getTime();
  if (Number.isNaN(target)) return null;
  const start = new Date(`${since}T00:00:00+04:00`).getTime();
  const diff = target - now;
  const live = diff <= 0;
  const pct = Math.max(0, Math.min(100, ((now - start) / (target - start)) * 100));
  const p = (n: number) => String(n).padStart(2, "0");
  const units = [
    { v: Math.floor(diff / 86400000), l: "Days" },
    { v: Math.floor(diff / 3600000) % 24, l: "Hours" },
    { v: Math.floor(diff / 60000) % 60, l: "Minutes" },
    { v: Math.floor(diff / 1000) % 60, l: "Seconds" },
  ];
  const dateLabel = new Date(`${date.slice(0, 10)}T12:00:00+04:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });

  return (
    <div className="fade-up relative w-full max-w-3xl mx-auto rounded-[20px] overflow-hidden mb-8" style={{ padding: 1 }}>
      <div className="hud-spin-layer absolute inset-[-100%]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, #D4AF37 16deg, transparent 55deg, transparent 180deg, #FF7A3D 200deg, transparent 240deg, transparent 360deg)" }} />
      <div className="relative rounded-[19px] px-3 sm:px-6 pt-5 pb-5 overflow-hidden" style={{ background: "linear-gradient(180deg,#0B1226,#070B16)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(212,175,55,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,.06) 1px,transparent 1px)", backgroundSize: "28px 28px", WebkitMaskImage: "radial-gradient(ellipse at 50% 0,#000,transparent 75%)", maskImage: "radial-gradient(ellipse at 50% 0,#000,transparent 75%)" }} />
        <span className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2" style={{ borderColor: "#D4AF37" }} />
        <span className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2" style={{ borderColor: "#D4AF37" }} />
        <span className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2" style={{ borderColor: "#D4AF37" }} />
        <span className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2" style={{ borderColor: "#D4AF37" }} />

        <div className="relative flex items-center justify-center gap-2 mb-4 font-mono text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.32em] text-goldBright">
          <span className="relative flex h-2 w-2">
            <span className="radar-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "#3DDC97" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#3DDC97", boxShadow: "0 0 8px #3DDC97" }} />
          </span>
          {live ? "Match Day Is Live" : "Match Day Countdown"}
        </div>

        {live ? (
          <div className="relative text-center py-4">
            <div className="font-display font-black text-3xl sm:text-5xl text-goldBright tracking-wide animate-pulse" style={{ textShadow: "0 0 24px rgba(240,201,74,.7)" }}>IT&apos;S MATCH DAY!</div>
            <a href="/matches" className="inline-block mt-4 text-sm font-semibold text-orange hover:underline">Follow live scores →</a>
          </div>
        ) : (
          <>
            <div className="relative flex items-start justify-center gap-1.5 sm:gap-2.5">
              {units.map((u, i) => (
                <div key={u.l} className="flex items-start gap-1.5 sm:gap-2.5 flex-1 sm:flex-none">
                  <div className="flex-1 sm:w-32 text-center">
                    <div
                      className="relative rounded-xl py-3 sm:py-4 font-mono font-bold text-3xl sm:text-6xl leading-none"
                      style={{
                        background: "linear-gradient(180deg,#1a2442,#0c1328)",
                        border: `1px solid ${i === 3 ? "rgba(212,175,55,.6)" : "#2E4066"}`,
                        color: i === 3 ? "#F0C94A" : "#fff",
                        textShadow: i === 3 ? "0 0 22px rgba(240,201,74,.9)" : "0 0 18px rgba(240,201,74,.55)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.12),0 8px 24px rgba(0,0,0,.5)",
                      }}
                    >
                      {p(u.v)}
                      <span className="absolute left-0 right-0 top-1/2 h-px bg-black/55" />
                    </div>
                    <div className="mt-2 font-mono text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.3em] text-muted">{u.l}</div>
                  </div>
                  {i < 3 && <span className="hidden sm:block font-mono font-bold text-4xl text-gold mt-5 animate-pulse">:</span>}
                </div>
              ))}
            </div>
            <div className="relative mx-3 sm:mx-5 mt-5 h-[3px] rounded bg-[#17213d] overflow-hidden">
              <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#D4AF37,#FF7A3D)", boxShadow: "0 0 10px #D4AF37" }} />
            </div>
          </>
        )}

        <div className="relative mt-3 text-center font-mono text-[9px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.18em] text-muted">
          <b className="text-white">{dateLabel}</b>{venue ? <> · {venue}</> : null}
        </div>
      </div>
    </div>
  );
}
