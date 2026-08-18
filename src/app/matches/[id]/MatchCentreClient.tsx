"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui";
import { computeInningsState, formatOvers, runRate, type BallRow } from "@/lib/scoring";

export default function MatchCentreClient({ match, teamA, teamB, players, settings, initialInnings1, initialInnings2, initialBalls1, initialBalls2 }: any) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`match-centre-${match.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings", filter: `match_id=eq.${match.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "balls" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  const playerName = (id: string | null) => players.find((p: any) => p.id === id)?.full_name || "—";
  const teamName = (id: string | null) => (id === teamA?.id ? teamA?.name : id === teamB?.id ? teamB?.name : "TBA");

  const s1 = initialInnings1 ? computeInningsState(initialBalls1 as BallRow[], { striker: initialInnings1.opening_striker_id, nonStriker: initialInnings1.opening_non_striker_id, bowler: initialInnings1.opening_bowler_id }, settings.playingXI, settings.oversLimit) : null;
  const s2 = initialInnings2 ? computeInningsState(initialBalls2 as BallRow[], { striker: initialInnings2.opening_striker_id, nonStriker: initialInnings2.opening_non_striker_id, bowler: initialInnings2.opening_bowler_id }, settings.playingXI, settings.oversLimit) : null;

  const liveInnings = initialInnings1?.status === "In Progress" ? { innings: initialInnings1, state: s1! }
    : initialInnings2?.status === "In Progress" ? { innings: initialInnings2, state: s2! }
    : null;

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">{match.status === "Live" ? "🔴 Live Match Centre" : match.status === "Completed" ? "Match Result" : "Match Centre"}</div>
            <div className="font-bold text-sm font-display">{settings.tournamentName}</div>
          </div>
          <Link href="/standings" className="text-xs text-mutedDim underline">All Fixtures</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-8">
        <div className="text-center mb-8">
          <div className="text-xs text-mutedDim mb-1">{match.stage}{match.match_number ? ` · Match ${match.match_number}` : ""}</div>
          <h1 className="text-2xl font-bold font-display">{teamName(match.team_a_id)} <span className="text-mutedDim">vs</span> {teamName(match.team_b_id)}</h1>
          <div className="text-xs text-mutedDim mt-1">{match.match_date || "Date TBA"} {match.match_time || ""} {match.ground ? `· ${match.ground}` : ""}</div>
        </div>

        {liveInnings && (
          <div className="rounded-2xl border p-6 mb-8 text-center" style={{ borderColor: "rgba(212,175,55,0.3)", background: "linear-gradient(160deg, rgba(212,175,55,0.07), rgba(255,122,61,0.04))" }}>
            <div className="text-sm text-mutedDim mb-1">{teamName(liveInnings.innings.batting_team_id)} batting</div>
            <div className="text-5xl font-bold font-display text-goldBright">{liveInnings.state.totalRuns}/{liveInnings.state.totalWickets}</div>
            <div className="text-sm text-muted mt-1">{formatOvers(liveInnings.state.legalBalls)} overs · CRR {runRate(liveInnings.state.totalRuns, liveInnings.state.legalBalls)}</div>
            {liveInnings.innings.target && (
              <div className="text-sm text-orange font-semibold mt-2">
                Need {Math.max(0, liveInnings.innings.target - liveInnings.state.totalRuns)} runs from {Math.max(0, settings.oversLimit * 6 - liveInnings.state.legalBalls)} balls
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-5 text-left">
              <div className="rounded-xl bg-bgCard border border-line p-3">
                <div className="text-[10px] uppercase text-mutedDim mb-1">Batting</div>
                {[liveInnings.state.striker, liveInnings.state.nonStriker].filter((id): id is string => !!id).map((id) => (
                  <div key={id} className="flex justify-between text-sm py-0.5">
                    <span>{playerName(id)}{id === liveInnings.state.striker ? " *" : ""}</span>
                    <span className="text-mutedDim">{liveInnings.state.batting[id]?.runs ?? 0} ({liveInnings.state.batting[id]?.balls ?? 0})</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-bgCard border border-line p-3">
                <div className="text-[10px] uppercase text-mutedDim mb-1">Bowling</div>
                {liveInnings.state.bowler && (
                  <div className="flex justify-between text-sm py-0.5">
                    <span>{playerName(liveInnings.state.bowler)}</span>
                    <span className="text-mutedDim">{formatOvers(liveInnings.state.bowling[liveInnings.state.bowler]?.legalBalls ?? 0)}-{liveInnings.state.bowling[liveInnings.state.bowler]?.runsConceded ?? 0}-{liveInnings.state.bowling[liveInnings.state.bowler]?.wickets ?? 0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {match.status === "Completed" && (
          <div className="text-center mb-8">
            <Badge tone="gold">{match.is_tie ? "Match Tied" : match.winner_id ? `${teamName(match.winner_id)} won${match.margin ? " by " + match.margin : ""}` : "Result Pending"}</Badge>
          </div>
        )}

        {s1 && <InningsScorecard title={`${teamName(initialInnings1.batting_team_id)} Innings`} state={s1} playerName={playerName} />}
        {s2 && <InningsScorecard title={`${teamName(initialInnings2.batting_team_id)} Innings`} state={s2} playerName={playerName} />}

        {!initialInnings1 && <div className="text-center text-sm text-mutedDim py-12">Scoring hasn&apos;t started for this match yet.</div>}
      </div>
    </div>
  );
}

function InningsScorecard({ title, state, playerName }: { title: string; state: any; playerName: (id: string | null) => string }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold font-display mb-3">{title} — {state.totalRuns}/{state.totalWickets} ({formatOvers(state.legalBalls)} ov)</h2>
      <div className="rounded-xl border border-line overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bgCard text-mutedDim text-[10px] uppercase">
              <th className="text-left py-2 px-3">Batter</th>
              <th className="py-2 px-2">R</th>
              <th className="py-2 px-2">B</th>
              <th className="py-2 px-2">4s</th>
              <th className="py-2 px-2">6s</th>
            </tr>
          </thead>
          <tbody>
            {state.battingOrder.map((id: string) => {
              const b = state.batting[id];
              return (
                <tr key={id} className="border-t border-line">
                  <td className="py-2 px-3">
                    <div>{playerName(id)}{id === state.striker ? " *" : ""}</div>
                    <div className="text-[10px] text-mutedDim">{b.out ? b.howOut : "not out"}</div>
                  </td>
                  <td className="text-center py-2 px-2 font-semibold">{b.runs}</td>
                  <td className="text-center py-2 px-2 text-mutedDim">{b.balls}</td>
                  <td className="text-center py-2 px-2 text-mutedDim">{b.fours}</td>
                  <td className="text-center py-2 px-2 text-mutedDim">{b.sixes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bgCard text-mutedDim text-[10px] uppercase">
              <th className="text-left py-2 px-3">Bowler</th>
              <th className="py-2 px-2">O</th>
              <th className="py-2 px-2">R</th>
              <th className="py-2 px-2">W</th>
            </tr>
          </thead>
          <tbody>
            {state.bowlingOrder.map((id: string) => {
              const bl = state.bowling[id];
              return (
                <tr key={id} className="border-t border-line">
                  <td className="py-2 px-3">{playerName(id)}</td>
                  <td className="text-center py-2 px-2 text-mutedDim">{formatOvers(bl.legalBalls)}</td>
                  <td className="text-center py-2 px-2 text-mutedDim">{bl.runsConceded}</td>
                  <td className="text-center py-2 px-2 font-semibold text-goldBright">{bl.wickets}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
