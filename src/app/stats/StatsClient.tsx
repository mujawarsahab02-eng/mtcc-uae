"use client";

import { useState } from "react";

type Row = Record<string, any>;
type Board = {
  key: string;
  title: string;
  badge?: string;
  source: "batting" | "bowling" | "fielding";
  filter?: (r: Row) => boolean;
  sort: (a: Row, b: Row) => number;
  value: (r: Row) => string;
  valueLabel: string;
  extra: (r: Row) => string;
  note?: string;
};

const n = (v: any) => Number(v ?? 0);

// Qualifying minimums scale with the format being played (see page.tsx).
function makeBoards(minSrBalls: number, minEconBalls: number): Board[] {
  const econOvers = Math.round(minEconBalls / 6);
  return [
  { key: "runs", title: "Most Runs", badge: "🧡 Orange Cap", source: "batting", sort: (a, b) => n(b.runs) - n(a.runs) || n(b.strike_rate) - n(a.strike_rate),
    value: (r) => String(n(r.runs)), valueLabel: "Runs", extra: (r) => `${n(r.innings)} inn · HS ${n(r.highest)} · SR ${r.strike_rate ?? "-"}` },
  { key: "wickets", title: "Most Wickets", badge: "💜 Purple Cap", source: "bowling", filter: (r) => n(r.wickets) > 0, sort: (a, b) => n(b.wickets) - n(a.wickets) || n(a.economy) - n(b.economy),
    value: (r) => String(n(r.wickets)), valueLabel: "Wkts", extra: (r) => `${r.overs} ov · Econ ${r.economy ?? "-"} · Best ${n(r.best_wickets)}/${n(r.best_runs)}` },
  { key: "sixes", title: "Most Sixes", source: "batting", filter: (r) => n(r.sixes) > 0, sort: (a, b) => n(b.sixes) - n(a.sixes) || n(b.runs) - n(a.runs),
    value: (r) => String(n(r.sixes)), valueLabel: "6s", extra: (r) => `${n(r.runs)} runs · ${n(r.innings)} inn` },
  { key: "fours", title: "Most Fours", source: "batting", filter: (r) => n(r.fours) > 0, sort: (a, b) => n(b.fours) - n(a.fours) || n(b.runs) - n(a.runs),
    value: (r) => String(n(r.fours)), valueLabel: "4s", extra: (r) => `${n(r.runs)} runs · ${n(r.innings)} inn` },
  { key: "highest", title: "Highest Score", source: "batting", filter: (r) => n(r.highest) > 0, sort: (a, b) => n(b.highest) - n(a.highest),
    value: (r) => String(n(r.highest)), valueLabel: "HS", extra: (r) => `${n(r.runs)} total runs` },
  { key: "sr", title: "Best Strike Rate", source: "batting", filter: (r) => n(r.balls) >= minSrBalls, sort: (a, b) => n(b.strike_rate) - n(a.strike_rate),
    value: (r) => String(r.strike_rate ?? "-"), valueLabel: "SR", extra: (r) => `${n(r.runs)} runs off ${n(r.balls)} balls`, note: `Minimum ${minSrBalls} balls faced` },
  { key: "econ", title: "Best Economy", source: "bowling", filter: (r) => n(r.balls) >= minEconBalls, sort: (a, b) => n(a.economy) - n(b.economy),
    value: (r) => String(r.economy ?? "-"), valueLabel: "Econ", extra: (r) => `${r.overs} ov · ${n(r.wickets)} wkts`, note: `Minimum ${econOvers} over${econOvers === 1 ? "" : "s"} bowled` },
  { key: "catches", title: "Most Catches", source: "fielding", filter: (r) => n(r.catches) > 0, sort: (a, b) => n(b.catches) - n(a.catches),
    value: (r) => String(n(r.catches)), valueLabel: "Ct", extra: (r) => `${n(r.run_outs)} run outs · ${n(r.stumpings)} stumpings` },
  ];
}

function initials(name: string) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// Combine rows for the same player (e.g. listed under two teams).
function mergeByPlayer(rows: Row[], source: Board["source"]): Row[] {
  const map = new Map<string, Row>();
  for (const r of rows) {
    const prev = map.get(r.player_id);
    if (!prev) { map.set(r.player_id, { ...r }); continue; }
    if (source === "batting") {
      const runs = n(prev.runs) + n(r.runs), balls = n(prev.balls) + n(r.balls);
      map.set(r.player_id, { ...prev, runs, balls, innings: n(prev.innings) + n(r.innings), matches: n(prev.matches) + n(r.matches),
        fours: n(prev.fours) + n(r.fours), sixes: n(prev.sixes) + n(r.sixes), highest: Math.max(n(prev.highest), n(r.highest)),
        strike_rate: balls ? ((runs * 100) / balls).toFixed(2) : null });
    } else if (source === "bowling") {
      const runs = n(prev.runs) + n(r.runs), balls = n(prev.balls) + n(r.balls);
      map.set(r.player_id, { ...prev, runs, balls, wickets: n(prev.wickets) + n(r.wickets),
        overs: `${Math.floor(balls / 6)}.${balls % 6}`, economy: balls ? ((runs * 6) / balls).toFixed(2) : null });
    } else {
      map.set(r.player_id, { ...prev, catches: n(prev.catches) + n(r.catches), run_outs: n(prev.run_outs) + n(r.run_outs), stumpings: n(prev.stumpings) + n(r.stumpings) });
    }
  }
  return Array.from(map.values());
}

export default function StatsClient({ batting, bowling, fielding, teams, minSrBalls, minEconBalls }: {
  batting: Row[]; bowling: Row[]; fielding: Row[]; teams: Row[]; minSrBalls: number; minEconBalls: number;
}) {
  const [active, setActive] = useState("runs");
  const BOARDS = makeBoards(minSrBalls, minEconBalls);
  const board = BOARDS.find((b) => b.key === active)!;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "";

  const sources = {
    batting: mergeByPlayer(batting, "batting"),
    bowling: mergeByPlayer(bowling, "bowling"),
    fielding: mergeByPlayer(fielding, "fielding"),
  };
  const rows = sources[board.source].filter((r) => (board.filter ? board.filter(r) : true)).sort(board.sort).slice(0, 10);
  const nothingYet = batting.length === 0 && bowling.length === 0;

  if (nothingYet) {
    return <div className="text-center text-sm text-slateText py-16">Stats will appear here once the first match is scored.</div>;
  }

  const leader = rows[0];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {BOARDS.map((b) => (
          <button key={b.key} type="button" onClick={() => setActive(b.key)}
            className="px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors"
            style={active === b.key
              ? { background: "#0A0F1C", color: "#F0C94A", borderColor: "#0A0F1C" }
              : { background: "#FFFFFF", color: "#5B6478", borderColor: "rgba(0,0,0,0.08)" }}>
            {b.title}
          </button>
        ))}
      </div>

      {leader ? (
        <div className="rounded-2xl p-6 mb-5 flex items-center gap-5 shadow-sm"
          style={{ background: "linear-gradient(135deg, #0A0F1C, #1C2944)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shrink-0"
            style={{ background: "rgba(212,175,55,0.18)", color: "#F0C94A", border: "2px solid rgba(212,175,55,0.6)" }}>
            {initials(leader.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: "#FF9A66" }}>{board.badge || `Leader · ${board.title}`}</div>
            <div className="text-lg font-bold text-white truncate">{leader.full_name}</div>
            <div className="text-xs truncate" style={{ color: "#8B98B5" }}>{teamName(leader.team_id)}</div>
            <div className="text-[11px] truncate mt-0.5" style={{ color: "#C7CEDD" }}>{board.extra(leader)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-4xl font-black font-display" style={{ color: "#F0C94A" }}>{board.value(leader)}</div>
            <div className="text-[11px] uppercase" style={{ color: "#8B98B5" }}>{board.valueLabel}</div>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-slateText py-10">No one qualifies for this list yet.</div>
      )}

      {rows.length > 1 && (
        <div className="rounded-2xl border border-black/5 shadow-sm bg-white overflow-hidden">
          {rows.slice(1).map((r, i) => (
            <div key={r.player_id} className="flex items-center gap-3 px-4 py-3 border-t border-black/5 first:border-0">
              <div className="w-6 text-sm font-bold text-slateText text-center">{i + 2}</div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-cream text-navyText">{initials(r.full_name)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-navyText truncate">{r.full_name}</div>
                <div className="text-[11px] text-slateText truncate">{teamName(r.team_id)}{teamName(r.team_id) ? " · " : ""}{board.extra(r)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-orange">{board.value(r)}</div>
                <div className="text-[10px] uppercase text-slateText">{board.valueLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {board.note && <div className="text-[11px] text-slateText mt-3 text-center">{board.note}</div>}
    </div>
  );
}
