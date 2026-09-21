"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui";
import { computeInningsState, economy, formatOvers, runRate, strikeRate, ballLabel, SHOT_ZONES, type BallRow } from "@/lib/scoring";
// Shared with the scorer's screen so fans and scorers see identical cards.
import { OversView, PartnershipsView, ScorecardView, ThisOverChips, type InningsView } from "@/app/admin/(dashboard)/scoring/[matchId]/MatchTabs";

type Tab = "Live" | "Commentary" | "Scorecard" | "Wagon Wheel" | "Overs" | "Partnerships";

export default function MatchCentreClient({ match, teamA, teamB, players, xiCounts, settings, initialInnings1, initialInnings2, initialBalls1, initialBalls2 }: any) {
  const router = useRouter();
  const isLive = match.status === "Live";
  const [tab, setTab] = useState<Tab>(isLive ? "Live" : initialInnings1 ? "Scorecard" : "Live");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`match-centre-${match.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings", filter: `match_id=eq.${match.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "balls" }, () => router.refresh())
      .subscribe();
    // Fallback refresh while live, in case live updates are blocked on the network.
    const timer = isLive ? setInterval(() => router.refresh(), 15000) : null;
    return () => { supabase.removeChannel(channel); if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, isLive]);

  const playerName = (id: string | null) => players.find((p: any) => p.id === id)?.full_name || "—";
  const teamName = (id: string | null) => (id === teamA?.id ? teamA?.name : id === teamB?.id ? teamB?.name : "TBA");
  const maxWicketsFor = (teamId: string) => ((xiCounts?.[teamId] ?? 0) >= 2 ? xiCounts[teamId] : settings.playingXI) - 1;

  const makeView = (innings: any, balls: any[]): InningsView => {
    const oversLimit: number = innings.overs_limit ?? settings.oversLimit;
    return {
      innings, balls, oversLimit,
      battingName: teamName(innings.batting_team_id),
      bowlingName: teamName(innings.bowling_team_id),
      state: computeInningsState(
        balls as BallRow[],
        { striker: innings.opening_striker_id, nonStriker: innings.opening_non_striker_id, bowler: innings.opening_bowler_id },
        maxWicketsFor(innings.batting_team_id), oversLimit
      ),
    };
  };
  const views: InningsView[] = [];
  if (initialInnings1) views.push(makeView(initialInnings1, initialBalls1));
  if (initialInnings2) views.push(makeView(initialInnings2, initialBalls2));

  const current = views.find((v) => v.innings.status === "In Progress") || views[views.length - 1] || null;

  const result = match.status === "Abandoned" ? "Match Abandoned"
    : match.result_type === "No Result" ? "No Result"
    : match.is_tie ? "Match Tied"
    : match.winner_id ? `${teamName(match.winner_id)} won${match.margin ? " by " + match.margin : ""}`
    : null;

  const tabs: Tab[] = ["Live", "Commentary", "Scorecard", "Wagon Wheel", "Overs", "Partnerships"];

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">
              {isLive ? "🔴 Live Match Centre" : match.status === "Completed" ? "Match Result" : "Match Centre"}
            </div>
            <div className="font-bold text-sm font-display">{settings.tournamentName}</div>
          </div>
          <Link href="/standings" className="text-xs text-mutedDim underline">All Fixtures</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="text-center mb-5">
          <div className="text-xs text-mutedDim mb-1">{match.stage}{match.match_number ? ` · Match ${match.match_number}` : ""}</div>
          <h1 className="text-xl font-bold font-display">{teamName(match.team_a_id)} <span className="text-mutedDim">vs</span> {teamName(match.team_b_id)}</h1>
          <div className="text-xs text-mutedDim mt-1">{match.match_date || "Date TBA"} {match.match_time || ""} {match.ground ? `· ${match.ground}` : ""}</div>
        </div>

        {/* Summary strip: both innings at a glance */}
        {views.length > 0 && (
          <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "rgba(212,175,55,0.3)", background: "linear-gradient(160deg, rgba(212,175,55,0.07), rgba(255,122,61,0.04))" }}>
            {views.map((v) => (
              <div key={v.innings.id} className="flex items-baseline justify-between py-1">
                <span className={`text-sm ${v === current && isLive ? "font-bold" : "text-muted"}`}>{v.battingName}</span>
                <span className={v === current && isLive ? "text-2xl font-bold font-display text-goldBright" : "text-base font-semibold"}>
                  {v.state.totalRuns}/{v.state.totalWickets} <span className="text-xs text-mutedDim font-normal">({formatOvers(v.state.legalBalls)}/{v.oversLimit} ov)</span>
                </span>
              </div>
            ))}
            {isLive && current && (
              <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 text-mutedDim">
                <span>CRR <b className="text-ink">{runRate(current.state.totalRuns, current.state.legalBalls)}</b></span>
                {current.innings.target && (() => {
                  const need = Math.max(0, current.innings.target - current.state.totalRuns);
                  const left = Math.max(0, current.oversLimit * 6 - current.state.legalBalls);
                  return (
                    <>
                      <span>RRR <b className="text-ink">{left ? ((need / left) * 6).toFixed(2) : "-"}</b></span>
                      <span className="text-orange font-semibold">Need {need} from {left} ball{left === 1 ? "" : "s"}</span>
                    </>
                  );
                })()}
                {current.innings.status === "Completed" && !initialInnings2 && <span className="text-orange font-semibold">Innings break</span>}
              </div>
            )}
            {result && <div className="text-center mt-3"><Badge tone="gold">{result}</Badge></div>}
            {match.man_of_match && <div className="text-center text-xs text-mutedDim mt-2">Man of the Match: <b className="text-ink">{match.man_of_match}</b></div>}
          </div>
        )}

        {views.length === 0 && (
          <div className="text-center text-sm text-mutedDim py-12">
            {isLive ? "Toss ho gaya, match shuru hone wala hai. Stay tuned!" : "Scoring hasn't started for this match yet."}
          </div>
        )}

        {views.length > 0 && (
          <>
            <div className="flex gap-1 mb-4 overflow-x-auto sticky top-[57px] z-10 bg-bg/95 py-2 -mx-1 px-1">
              {tabs.map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={{ color: tab === t ? "#F0C94A" : "#8B98B5", background: tab === t ? "rgba(212,175,55,0.12)" : "transparent" }}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "Live" && current && (
              <LivePanel view={current} views={views} isLive={isLive} playerName={playerName} onAllCommentary={() => setTab("Commentary")} />
            )}
            {tab === "Commentary" && <CommentaryFeed views={views} />}
            {tab === "Scorecard" && <ScorecardView views={views} playerName={playerName} />}
            {tab === "Wagon Wheel" && <WagonWheel views={views} playerName={playerName} />}
            {tab === "Overs" && <OversView views={views} playerName={playerName} />}
            {tab === "Partnerships" && <PartnershipsView views={views} playerName={playerName} />}
          </>
        )}

        {match.cricheroes_url && (
          <div className="text-center mt-8">
            <a href={match.cricheroes_url} target="_blank" rel="noopener noreferrer" className="text-xs text-mutedDim underline">Also on CricHeroes ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}

function LivePanel({ view, views, isLive, playerName, onAllCommentary }: { view: InningsView; views: InningsView[]; isLive: boolean; playerName: (id: string | null) => string; onAllCommentary: () => void }) {
  const { innings, state } = view;
  const inProgress = innings.status === "In Progress";
  const strikerId: string | null = innings.current_striker_id;
  const nonStrikerId: string | null = innings.current_non_striker_id;
  const bowlerId: string | null = innings.current_bowler_id;
  const lastP = state.partnerships[state.partnerships.length - 1];
  const bowler = bowlerId ? state.bowling[bowlerId] : null;

  return (
    <div className="space-y-3">
      {inProgress && (
        <div className="rounded-2xl bg-bgCard border border-line p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase text-mutedDim">
                <th className="text-left font-semibold pb-1">Batter</th>
                <th className="text-right font-semibold pb-1">R</th><th className="text-right font-semibold pb-1">B</th>
                <th className="text-right font-semibold pb-1">4s</th><th className="text-right font-semibold pb-1">6s</th><th className="text-right font-semibold pb-1">SR</th>
              </tr>
            </thead>
            <tbody>
              {[strikerId, nonStrikerId].filter((id): id is string => !!id).map((id) => {
                const l = state.batting[id];
                return (
                  <tr key={id}>
                    <td className="py-1">{playerName(id)}{id === strikerId ? <span className="text-goldBright"> *</span> : ""}</td>
                    <td className="text-right font-bold">{l?.runs ?? 0}</td><td className="text-right text-mutedDim">{l?.balls ?? 0}</td>
                    <td className="text-right text-mutedDim">{l?.fours ?? 0}</td><td className="text-right text-mutedDim">{l?.sixes ?? 0}</td>
                    <td className="text-right text-mutedDim">{strikeRate(l?.runs ?? 0, l?.balls ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {bowlerId && (
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-line">
              <span>{playerName(bowlerId)} <span className="text-[11px] text-mutedDim">bowling</span></span>
              <span className="text-mutedDim">
                {formatOvers(bowler?.legalBalls ?? 0)}-{bowler?.maidens ?? 0}-{bowler?.runsConceded ?? 0}-{bowler?.wickets ?? 0} · Econ {economy(bowler?.runsConceded ?? 0, bowler?.legalBalls ?? 0)}
              </span>
            </div>
          )}
          {lastP && <div className="text-xs text-mutedDim mt-2">Partnership <b className="text-ink">{lastP.runs} ({lastP.balls})</b></div>}
          <div className="mt-3">
            <div className="text-[10px] uppercase text-mutedDim mb-1.5">This over</div>
            <ThisOverChips state={state} />
          </div>
        </div>
      )}

      {!inProgress && isLive && (
        <div className="rounded-2xl bg-bgCard border border-line p-4 text-sm text-center text-mutedDim">
          Innings break. {view.battingName} ne {state.totalRuns}/{state.totalWickets} banaye. Target {state.totalRuns + 1}.
        </div>
      )}

      <div className="rounded-2xl bg-bgCard border border-line p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] uppercase text-mutedDim">Commentary</div>
          <button type="button" onClick={onAllCommentary} className="text-xs text-goldBright underline">Full commentary</button>
        </div>
        <CommentaryList views={views} limit={8} />
      </div>
    </div>
  );
}

function chipStyle(b: any) {
  const isW = b.is_wicket;
  const isB = !b.extra_type && (b.runs_off_bat === 4 || b.runs_off_bat === 6);
  return {
    borderColor: isW ? "#FF5D6C" : isB ? "#D4AF37" : "rgba(255,255,255,0.15)",
    color: isW ? "#FF5D6C" : isB ? "#F0C94A" : "#C7CEDD",
    background: isW ? "rgba(255,93,108,0.12)" : isB ? "rgba(212,175,55,0.12)" : "transparent",
  };
}

// Ball-by-ball Hinglish commentary, newest first. The end-of-over summary
// (second line of the ball that finished the over) shows as its own strip.
function CommentaryList({ views, limit }: { views: InningsView[]; limit?: number }) {
  const rows: { key: string; header?: string; ball?: any }[] = [];
  for (const v of [...views].reverse()) {
    const balls = [...v.balls].reverse();
    if (views.length > 1) rows.push({ key: `h-${v.innings.id}`, header: `${v.battingName} · Innings ${v.innings.innings_number}` });
    for (const b of balls) rows.push({ key: b.id, ball: b });
  }
  const shown = limit ? rows.filter((r) => r.ball).slice(0, limit).map((r) => r) : rows;

  if (!shown.some((r) => r.ball)) return <div className="text-xs text-mutedDim">Commentary starts with the first ball.</div>;

  return (
    <div>
      {shown.map((r) => {
        if (r.header) return <div key={r.key} className="text-xs font-bold text-muted mt-4 mb-1 first:mt-0">{r.header}</div>;
        const b = r.ball;
        const [main, overSummary] = String(b.commentary || "").split("\n");
        return (
          <div key={r.key}>
            {overSummary && (
              <div className="text-[11px] font-semibold my-2 px-3 py-2 rounded-lg" style={{ background: "rgba(212,175,55,0.08)", color: "#F0C94A" }}>
                {overSummary}
              </div>
            )}
            <div className="flex gap-3 py-2 border-b border-line last:border-0">
              <div className="shrink-0 w-11 text-center">
                <div className="text-[10px] text-mutedDim">{b.event_type ? "" : `${b.over_number}.${b.ball_in_over}`}</div>
                {!b.event_type && (
                  <span className="mt-0.5 min-w-[28px] h-[28px] px-1 rounded-full inline-flex items-center justify-center text-[11px] font-bold border" style={chipStyle(b)}>
                    {ballLabel(b)}
                  </span>
                )}
              </div>
              <div className="text-sm leading-snug pt-0.5">{main || "—"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentaryFeed({ views }: { views: InningsView[] }) {
  return (
    <div className="rounded-2xl bg-bgCard border border-line p-4">
      <CommentaryList views={views} />
    </div>
  );
}

// Where the runs went. Each scoring shot the scorer tagged with a direction
// is drawn from the batter to that part of the ground.
function WagonWheel({ views, playerName }: { views: InningsView[]; playerName: (id: string | null) => string }) {
  const [idx, setIdx] = useState(views.length - 1);
  const [batter, setBatter] = useState("");
  const v = views[Math.min(idx, views.length - 1)];

  const shots = v.balls.filter((b: any) =>
    !b.event_type && b.shot_x !== null && b.shot_x !== undefined && b.runs_off_bat > 0 && (!batter || b.striker_id === batter)
  );
  const batters = v.state.battingOrder.filter((id) => v.balls.some((b: any) => b.striker_id === id && b.shot_x !== null && b.shot_x !== undefined));

  const C = 150, BOUNDARY = 136;
  const lines = shots.map((b: any) => {
    const dx = Number(b.shot_x) - 0.5, dy = Number(b.shot_y) - 0.5;
    const len = Math.hypot(dx, dy) || 1;
    const reach = b.runs_off_bat >= 4 ? BOUNDARY : 55 + b.runs_off_bat * 20;
    // Small spread so several shots to one zone don't sit on top of each other.
    const jitter = ((b.sequence_no * 37) % 13 - 6) / 100;
    const ux = dx / len, uy = dy / len;
    const jx = ux * Math.cos(jitter) - uy * Math.sin(jitter), jy = ux * Math.sin(jitter) + uy * Math.cos(jitter);
    return { id: b.id, x2: C + jx * reach, y2: C + jy * reach, runs: b.runs_off_bat };
  });
  const color = (r: number) => (r === 6 ? "#F0C94A" : r === 4 ? "#4E9BFF" : r >= 2 ? "#3DDC97" : "#C7CEDD");

  const zoneTotals = SHOT_ZONES.map((z) => {
    const inZone = shots.filter((b: any) => Number(b.shot_x) === z.x && Number(b.shot_y) === z.y);
    return { label: z.label, runs: inZone.reduce((t: number, b: any) => t + b.runs_off_bat, 0), count: inZone.length };
  }).filter((z) => z.count > 0).sort((a, b) => b.runs - a.runs);

  return (
    <div className="rounded-2xl bg-bgCard border border-line p-4">
      <div className="flex gap-2 flex-wrap mb-3">
        {views.length > 1 && views.map((vv, i) => (
          <button key={vv.innings.id} type="button" onClick={() => { setIdx(i); setBatter(""); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: i === idx ? "#F0C94A" : "#8B98B5", background: i === idx ? "rgba(212,175,55,0.12)" : "transparent" }}>
            {vv.battingName}
          </button>
        ))}
        <select value={batter} onChange={(e: any) => setBatter(e.target.value)} className="text-xs !w-auto">
          <option value="">All batters</option>
          {batters.map((id) => <option key={id} value={id}>{playerName(id)}</option>)}
        </select>
      </div>

      <svg viewBox="0 0 300 300" className="w-full max-w-sm mx-auto block">
        <circle cx={C} cy={C} r={146} fill="#123524" />
        <circle cx={C} cy={C} r={BOUNDARY} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        <circle cx={C} cy={C} r={62} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
        <rect x={C - 5} y={C - 24} width={10} height={32} rx={2} fill="#C9B27C" opacity={0.85} />
        {lines.map((l) => (
          <line key={l.id} x1={C} y1={C} x2={l.x2} y2={l.y2} stroke={color(l.runs)} strokeWidth={l.runs >= 4 ? 2.2 : 1.4} strokeLinecap="round" opacity={0.9} />
        ))}
        <text x={C} y={14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.55)">bowler's end</text>
        <text x={290} y={C + 3} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.45)">OFF</text>
        <text x={10} y={C + 3} fontSize={9} fill="rgba(255,255,255,0.45)">LEG</text>
      </svg>

      <div className="flex justify-center gap-4 text-[11px] mt-3 flex-wrap">
        {[["1s", "#C7CEDD"], ["2s/3s", "#3DDC97"], ["4s", "#4E9BFF"], ["6s", "#F0C94A"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5 text-mutedDim"><span className="w-3 h-0.5 inline-block" style={{ background: c }} />{l}</span>
        ))}
      </div>

      {shots.length === 0 ? (
        <div className="text-xs text-mutedDim text-center mt-4">No shot directions recorded yet for this innings.</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          {zoneTotals.map((z) => (
            <div key={z.label} className="flex justify-between text-xs py-1 border-b border-line">
              <span className="text-mutedDim">{z.label}</span>
              <span><b>{z.runs}</b> <span className="text-mutedDim">({z.count} shot{z.count === 1 ? "" : "s"})</span></span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-mutedDim text-center mt-3">Directions shown as for a right-handed batter.</div>
    </div>
  );
}
