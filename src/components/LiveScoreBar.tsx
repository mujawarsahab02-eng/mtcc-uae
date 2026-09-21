"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LiveItem = {
  matchId: string;
  label: string;
  battingName: string;
  score: string;
  overs: string;
  detail: string;
};

function fmtOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

// Floating live score on every public page while a match is Live.
// Tapping it opens that match's live page; ✕ tucks it into a small pill.
export default function LiveScoreBar() {
  const pathname = usePathname() || "";
  const [items, setItems] = useState<LiveItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(sessionStorage.getItem("mtcc-live-collapsed") === "1"); } catch {}
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: live } = await supabase.from("match_public").select("id, team_a_id, team_b_id, stage, match_number").eq("status", "Live");
      if (cancelled) return;
      if (!live || live.length === 0) { setItems([]); return; }

      const ids = live.map((m: any) => m.id);
      const teamIds = Array.from(new Set(live.flatMap((m: any) => [m.team_a_id, m.team_b_id]).filter(Boolean)));
      const [{ data: inns }, { data: teams }] = await Promise.all([
        supabase.from("innings").select("match_id, innings_number, batting_team_id, total_runs, total_wickets, legal_balls, target, overs_limit, status, opening_striker_id").in("match_id", ids),
        supabase.from("team_public").select("id, name").in("id", teamIds),
      ]);
      if (cancelled) return;
      const nameOf = (id: string | null) => (teams ?? []).find((t: any) => t.id === id)?.name || "TBA";

      setItems(live.map((m: any) => {
        const mine = (inns ?? []).filter((i: any) => i.match_id === m.id && i.opening_striker_id)
          .sort((a: any, b: any) => b.innings_number - a.innings_number);
        const cur = mine.find((i: any) => i.status === "In Progress") || mine[0];
        const label = `${nameOf(m.team_a_id)} vs ${nameOf(m.team_b_id)}`;
        if (!cur) {
          return { matchId: m.id, label, battingName: "", score: "", overs: "", detail: "Match starting soon" };
        }
        let detail = "";
        if (cur.innings_number === 2 && cur.target) {
          const need = cur.target - cur.total_runs;
          const left = cur.overs_limit ? cur.overs_limit * 6 - cur.legal_balls : null;
          detail = need > 0 ? `Need ${need}${left !== null ? ` off ${Math.max(0, left)}` : ""}` : "Target reached";
        } else if (cur.status === "Completed") {
          detail = "Innings break";
        } else {
          detail = `Innings ${cur.innings_number}`;
        }
        return {
          matchId: m.id, label, battingName: nameOf(cur.batting_team_id),
          score: `${cur.total_runs}/${cur.total_wickets}`, overs: fmtOvers(cur.legal_balls), detail,
        };
      }));
    }

    load();
    const channel = supabase
      .channel("live-score-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "innings" }, () => load())
      .subscribe();
    // Fallback in case live updates are blocked on the fan's network.
    const timer = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(timer); supabase.removeChannel(channel); };
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;
  // On a match page, don't repeat that same match in the bar.
  const visible = items.filter((it) => !pathname.startsWith(`/matches/${it.matchId}`));
  if (visible.length === 0) return null;

  function setCollapsedSaved(v: boolean) {
    setCollapsed(v);
    try { sessionStorage.setItem("mtcc-live-collapsed", v ? "1" : "0"); } catch {}
  }

  const wrapStyle = { bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" };

  if (collapsed) {
    return (
      <button
        type="button" onClick={() => setCollapsedSaved(false)}
        className="fixed right-3 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg text-xs font-bold"
        style={{ ...wrapStyle, background: "#0A0F1C", color: "#F0C94A", border: "1px solid rgba(212,175,55,0.5)" }}
        aria-label="Show live score"
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#FF4D5E" }} />
        LIVE{visible.length > 1 ? ` · ${visible.length}` : ""}
      </button>
    );
  }

  return (
    <div className="fixed left-3 right-3 z-50 flex flex-col gap-2 items-center pointer-events-none" style={wrapStyle}>
      {visible.slice(0, 2).map((it, idx) => (
        <div key={it.matchId} className="pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl flex items-stretch overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0A0F1C, #16213A)", border: "1px solid rgba(212,175,55,0.45)" }}>
          <Link href={`/matches/${it.matchId}`} className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider shrink-0" style={{ color: "#FF6B78" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#FF4D5E" }} />
              LIVE
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] truncate" style={{ color: "#8B98B5" }}>{it.label}</span>
              <span className="block text-sm font-bold truncate" style={{ color: "#FFFFFF" }}>
                {it.score ? <>{it.battingName} <span style={{ color: "#F0C94A" }}>{it.score}</span> <span className="font-normal text-xs" style={{ color: "#8B98B5" }}>({it.overs})</span></> : it.detail}
              </span>
            </span>
            {it.score && <span className="text-[11px] font-semibold shrink-0 text-right" style={{ color: "#FF9A66" }}>{it.detail}</span>}
          </Link>
          {idx === 0 && (
            <button type="button" onClick={() => setCollapsedSaved(true)} className="px-3 text-sm shrink-0" style={{ color: "#8B98B5", borderLeft: "1px solid rgba(255,255,255,0.08)" }} aria-label="Minimise live score">
              ✕
            </button>
          )}
        </div>
      ))}
      {visible.length > 2 && (
        <Link href="/standings" className="pointer-events-auto text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: "#0A0F1C", color: "#F0C94A" }}>
          +{visible.length - 2} more live
        </Link>
      )}
    </div>
  );
}
