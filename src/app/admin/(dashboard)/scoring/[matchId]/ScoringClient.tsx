"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { computeInningsState, allowedWicketTypes, formatOvers, runRate, type BallRow } from "@/lib/scoring";
import { startInnings, recordBall, undoLastBall, setNewBowler } from "./actions";

type Player = { id: string; full_name: string; team_id: string };

export default function ScoringClient({
  match, teamA, teamB, squadA, squadB, settings,
  initialInnings1, initialInnings2, initialBalls1, initialBalls2, canScore,
}: {
  match: any; teamA: any; teamB: any; squadA: Player[]; squadB: Player[]; settings: { playingXI: number; oversLimit: number };
  initialInnings1: any; initialInnings2: any; initialBalls1: any[]; initialBalls2: any[]; canScore: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`scoring-${match.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings", filter: `match_id=eq.${match.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "balls" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  const allPlayers = [...squadA, ...squadB];
  const playerName = (id: string | null) => allPlayers.find((p) => p.id === id)?.full_name || "—";
  const squadFor = (teamId: string) => (teamId === teamA.id ? squadA : squadB);

  const activeInnings = !initialInnings1 ? null
    : initialInnings1.status === "In Progress" ? { innings: initialInnings1, balls: initialBalls1 }
    : initialInnings2 && initialInnings2.status === "In Progress" ? { innings: initialInnings2, balls: initialBalls2 }
    : null;

  if (match.status === "Completed" && initialInnings2?.status === "Completed") {
    return <MatchSummary match={match} teamA={teamA} teamB={teamB} innings1={initialInnings1} innings2={initialInnings2} balls1={initialBalls1} balls2={initialBalls2} settings={settings} />;
  }

  if (!initialInnings1) {
    return <StartInningsForm matchId={match.id} inningsNumber={1} teamA={teamA} teamB={teamB} squadA={squadA} squadB={squadB} defaultBattingTeamId={match.batting_first_id} />;
  }

  if (initialInnings1.status === "Completed" && !initialInnings2) {
    return (
      <div>
        <InningsSummaryCard title="Innings 1 Complete" innings={initialInnings1} balls={initialBalls1} teamName={initialInnings1.batting_team_id === teamA.id ? teamA.name : teamB.name} settings={settings} />
        <StartInningsForm
          matchId={match.id} inningsNumber={2} teamA={teamA} teamB={teamB} squadA={squadA} squadB={squadB}
          defaultBattingTeamId={initialInnings1.bowling_team_id} lockBattingTeam target={initialInnings1.total_runs + 1}
        />
      </div>
    );
  }

  if (activeInnings) {
    return (
      <LiveScoring
        match={match} teamA={teamA} teamB={teamB}
        innings={activeInnings.innings} balls={activeInnings.balls}
        battingSquad={squadFor(activeInnings.innings.batting_team_id)}
        bowlingSquad={squadFor(activeInnings.innings.bowling_team_id)}
        settings={settings} playerName={playerName} canScore={canScore}
      />
    );
  }

  return <Card className="p-8 text-center text-sm text-mutedDim">Loading match state…</Card>;
}

function StartInningsForm({ matchId, inningsNumber, teamA, teamB, squadA, squadB, defaultBattingTeamId, lockBattingTeam, target }: any) {
  const router = useRouter();
  const [battingTeamId, setBattingTeamId] = useState(defaultBattingTeamId || teamA.id);
  const battingSquad = battingTeamId === teamA.id ? squadA : squadB;
  const bowlingSquad = battingTeamId === teamA.id ? squadB : squadA;
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleStart() {
    if (!striker || !nonStriker || !bowler || striker === nonStriker) {
      setErr("Select two different opening batsmen and an opening bowler.");
      return;
    }
    setBusy(true); setErr("");
    const res: any = await startInnings({
      matchId, inningsNumber, battingTeamId, bowlingTeamId: battingTeamId === teamA.id ? teamB.id : teamA.id,
      strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler,
    });
    setBusy(false);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <Card className="p-5">
      <SectionHeader eyebrow="Live Scoring" title={`Start Innings ${inningsNumber}`} />
      <SeamDivider />
      {target && <div className="text-sm text-goldBright font-semibold mb-4">Target: {target} runs</div>}
      <Field label="Batting Team">
        {lockBattingTeam ? (
          <div className="text-sm font-semibold py-2">{battingTeamId === teamA.id ? teamA.name : teamB.name}</div>
        ) : (
          <select value={battingTeamId} onChange={(e) => setBattingTeamId(e.target.value)}>
            <option value={teamA.id}>{teamA.name}</option>
            <option value={teamB.id}>{teamB.name}</option>
          </select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Striker (on strike)">
          <select value={striker} onChange={(e) => setStriker(e.target.value)}>
            <option value="">Select</option>
            {battingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Non-Striker">
          <select value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
            <option value="">Select</option>
            {battingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Opening Bowler">
        <select value={bowler} onChange={(e) => setBowler(e.target.value)}>
          <option value="">Select</option>
          {bowlingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </Field>
      {err && <div className="text-xs mb-3 text-red">{err}</div>}
      <Button variant="primary" className="w-full" onClick={handleStart} disabled={busy}>{busy ? "Starting…" : `Start Innings ${inningsNumber}`}</Button>
    </Card>
  );
}

function LiveScoring({ match, teamA, teamB, innings, balls, battingSquad, bowlingSquad, settings, playerName, canScore }: any) {
  const router = useRouter();
  const battingTeamName = innings.batting_team_id === teamA.id ? teamA.name : teamB.name;
  const bowlingTeamName = innings.bowling_team_id === teamA.id ? teamA.name : teamB.name;

  const state = useMemo(
    () => computeInningsState(
      balls as BallRow[],
      { striker: innings.opening_striker_id, nonStriker: innings.opening_non_striker_id, bowler: innings.opening_bowler_id },
      settings.playingXI, settings.oversLimit
    ),
    [balls, innings, settings]
  );

  const needsNewBowler = innings.legal_balls > 0 && innings.legal_balls % 6 === 0 && innings.current_bowler_id === innings.last_over_bowler_id;

  const [extraType, setExtraType] = useState<null | "wide" | "no_ball" | "bye" | "leg_bye">(null);
  const [wicketMode, setWicketMode] = useState(false);
  const [wicketType, setWicketType] = useState("");
  const [dismissedId, setDismissedId] = useState("");
  const [fielderId, setFielderId] = useState("");
  const [newBatsmanId, setNewBatsmanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newBowlerId, setNewBowlerId] = useState("");

  const remainingBattingSquad = battingSquad.filter((p: Player) => !state.batting[p.id]?.out && p.id !== state.striker && p.id !== state.nonStriker);

  async function submitNewBowler() {
    if (!newBowlerId) return;
    setBusy(true); setErr("");
    const res: any = await setNewBowler(innings.id, match.id, newBowlerId);
    setBusy(false);
    if (res.error) setErr(res.error);
    else { setNewBowlerId(""); router.refresh(); }
  }

  async function submitBall(runsOffBat: number) {
    if (wicketMode && !wicketType) { setErr("Select a dismissal type."); return; }
    const allowed = allowedWicketTypes(extraType);
    if (wicketMode && !allowed.includes(wicketType)) { setErr(`${wicketType} is not valid off a ${extraType || "normal delivery"}.`); return; }
    if (wicketMode && remainingBattingSquad.length > 0 && !newBatsmanId) { setErr("Select the incoming batsman."); return; }

    let payloadExtraRuns = 0;
    let payloadRunsOffBat = runsOffBat;
    if (extraType === "wide") { payloadExtraRuns = 1 + runsOffBat; payloadRunsOffBat = 0; }
    else if (extraType === "bye" || extraType === "leg_bye") { payloadExtraRuns = runsOffBat; payloadRunsOffBat = 0; }
    else if (extraType === "no_ball") { payloadExtraRuns = 1; payloadRunsOffBat = runsOffBat; }

    const payload = {
      runsOffBat: payloadRunsOffBat,
      extraType,
      extraRuns: payloadExtraRuns,
      isWicket: wicketMode,
      wicketType: wicketMode ? wicketType : null,
      dismissedPlayerId: wicketMode ? (dismissedId || state.striker) : null,
      fielderId: wicketMode ? fielderId || null : null,
      newBatsmanId: wicketMode ? newBatsmanId || null : null,
    };

    setBusy(true); setErr("");
    const res: any = await recordBall(innings.id, match.id, payload);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setExtraType(null); setWicketMode(false); setWicketType(""); setDismissedId(""); setFielderId(""); setNewBatsmanId("");
    router.refresh();
  }

  async function handleUndo() {
    setBusy(true); setErr("");
    const res: any = await undoLastBall(innings.id, match.id);
    setBusy(false);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  const recentBalls = [...balls].slice(-8).reverse();
  const target = innings.target;
  const runsNeeded = target ? target - state.totalRuns : null;
  const ballsLeft = settings.oversLimit * 6 - state.legalBalls;

  return (
    <div>
      <SectionHeader eyebrow={`Innings ${innings.innings_number} · Live`} title={`${battingTeamName} vs ${bowlingTeamName}`} />
      <SeamDivider />

      <Card className="p-5 mb-4 text-center">
        <div className="text-sm text-mutedDim mb-1">{battingTeamName} batting</div>
        <div className="text-4xl font-bold font-display text-goldBright">{state.totalRuns}/{state.totalWickets}</div>
        <div className="text-sm text-muted mt-1">{formatOvers(state.legalBalls)} overs · CRR {runRate(state.totalRuns, state.legalBalls)}</div>
        {target && (
          <div className="text-sm text-orange font-semibold mt-2">
            Need {Math.max(0, runsNeeded!)} runs from {Math.max(0, ballsLeft)} balls
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase text-mutedDim mb-2">Batting</div>
         {[state.striker, state.nonStriker].filter((id): id is string => !!id).map((id) => (
            <div key={id} className="flex justify-between text-sm py-0.5">
              <span>{playerName(id)}{id === state.striker ? " *" : ""}</span>
              <span className="text-mutedDim">{state.batting[id]?.runs ?? 0} ({state.batting[id]?.balls ?? 0})</span>
            </div>
          ))}
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase text-mutedDim mb-2">Bowling</div>
          {state.bowler && (
            <div className="flex justify-between text-sm py-0.5">
              <span>{playerName(state.bowler)}</span>
              <span className="text-mutedDim">{formatOvers(state.bowling[state.bowler]?.legalBalls ?? 0)}-{state.bowling[state.bowler]?.runsConceded ?? 0}-{state.bowling[state.bowler]?.wickets ?? 0}</span>
            </div>
          )}
        </Card>
      </div>

      {recentBalls.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {recentBalls.map((b: any) => (
            <span key={b.id} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border" style={{
              borderColor: b.is_wicket ? "#FF5D6C" : "rgba(212,175,55,0.4)",
              color: b.is_wicket ? "#FF5D6C" : b.runs_off_bat === 4 || b.runs_off_bat === 6 ? "#F0C94A" : "#8B98B5",
              background: b.is_wicket ? "rgba(255,93,108,0.1)" : "transparent",
            }}>
              {b.is_wicket ? "W" : b.extra_type === "wide" ? "wd" : b.extra_type === "no_ball" ? "nb" : b.extra_type === "bye" ? `${b.extra_runs}b` : b.extra_type === "leg_bye" ? `${b.extra_runs}lb` : b.runs_off_bat}
            </span>
          ))}
        </div>
      )}

      {!canScore && <Card className="p-4 text-sm text-orange">Read-only for your role.</Card>}

      {canScore && needsNewBowler && (
        <Card className="p-5 mb-4">
          <div className="text-sm font-bold mb-3">Over complete — select the next bowler</div>
          <Field label="Next Bowler">
            <select value={newBowlerId} onChange={(e) => setNewBowlerId(e.target.value)}>
              <option value="">Select</option>
              {bowlingSquad.filter((p: Player) => p.id !== innings.last_over_bowler_id).map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          {err && <div className="text-xs mb-2 text-red">{err}</div>}
          <Button variant="primary" className="w-full" onClick={submitNewBowler} disabled={busy || !newBowlerId}>Confirm Bowler</Button>
        </Card>
      )}

      {canScore && !needsNewBowler && (
        <Card className="p-5">
          <div className="text-[11px] uppercase text-mutedDim mb-2">Delivery Type</div>
          <div className="flex gap-2 flex-wrap mb-4">
            {[
              { v: null, l: "Normal" }, { v: "wide", l: "Wide" }, { v: "no_ball", l: "No Ball" },
              { v: "bye", l: "Bye" }, { v: "leg_bye", l: "Leg Bye" },
            ].map((opt) => (
              <button key={opt.l} onClick={() => setExtraType(opt.v as any)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: extraType === opt.v ? "#D4AF37" : "rgba(255,255,255,0.1)", color: extraType === opt.v ? "#F0C94A" : "#8B98B5", background: extraType === opt.v ? "rgba(212,175,55,0.1)" : "transparent" }}>
                {opt.l}
              </button>
            ))}
          </div>

          {innings.is_free_hit && !wicketMode && <div className="text-xs text-orange font-semibold mb-3">🎯 FREE HIT</div>}

          <div className="text-[11px] uppercase text-mutedDim mb-2">{extraType === "bye" || extraType === "leg_bye" ? "Runs Run" : extraType ? "Additional Runs" : "Runs Off Bat"}</div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <Button key={r} variant="subtle" onClick={() => submitBall(r)} disabled={busy}>{r}</Button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm mb-3 text-muted">
            <input type="checkbox" className="!w-auto" checked={wicketMode} onChange={(e) => setWicketMode(e.target.checked)} /> Wicket on this delivery
          </label>

          {wicketMode && (
            <div className="mb-4 p-3 rounded-xl border border-red/30 bg-red/5">
              <Field label="Dismissal Type">
                <select value={wicketType} onChange={(e) => setWicketType(e.target.value)}>
                  <option value="">Select</option>
                  {allowedWicketTypes(extraType).map((w) => <option key={w}>{w}</option>)}
                </select>
              </Field>
              <Field label="Batsman Out">
                <select value={dismissedId} onChange={(e) => setDismissedId(e.target.value)}>
                  <option value="">Striker ({playerName(state.striker)})</option>
                  <option value={state.nonStriker || ""}>Non-Striker ({playerName(state.nonStriker)})</option>
                </select>
              </Field>
              {["Caught", "Run Out", "Stumped"].includes(wicketType) && (
                <Field label="Fielder (optional)">
                  <select value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
                    <option value="">—</option>
                    {bowlingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </Field>
              )}
              {remainingBattingSquad.length > 0 && (
                <Field label="Incoming Batsman">
                  <select value={newBatsmanId} onChange={(e) => setNewBatsmanId(e.target.value)}>
                    <option value="">Select</option>
                    {remainingBattingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          {err && <div className="text-xs mb-3 text-red">{err}</div>}

          <Button variant="subtle" size="sm" className="w-full" onClick={handleUndo} disabled={busy || balls.length === 0}>Undo Last Ball</Button>
        </Card>
      )}
    </div>
  );
}

function InningsSummaryCard({ title, innings, balls, teamName, settings }: any) {
  const state = computeInningsState(balls as BallRow[], { striker: innings.opening_striker_id, nonStriker: innings.opening_non_striker_id, bowler: innings.opening_bowler_id }, settings.playingXI, settings.oversLimit);
  return (
    <Card className="p-5 mb-5">
      <div className="text-xs font-bold uppercase text-mutedDim mb-1">{title}</div>
      <div className="text-2xl font-bold font-display">{teamName}: {state.totalRuns}/{state.totalWickets} <span className="text-base text-mutedDim">({formatOvers(state.legalBalls)} ov)</span></div>
    </Card>
  );
}

function MatchSummary({ match, teamA, teamB, innings1, innings2, balls1, balls2, settings }: any) {
  const s1 = computeInningsState(balls1 as BallRow[], { striker: innings1.opening_striker_id, nonStriker: innings1.opening_non_striker_id, bowler: innings1.opening_bowler_id }, settings.playingXI, settings.oversLimit);
  const s2 = computeInningsState(balls2 as BallRow[], { striker: innings2.opening_striker_id, nonStriker: innings2.opening_non_striker_id, bowler: innings2.opening_bowler_id }, settings.playingXI, settings.oversLimit);
  const team1Name = innings1.batting_team_id === teamA.id ? teamA.name : teamB.name;
  const team2Name = innings2.batting_team_id === teamA.id ? teamA.name : teamB.name;

  return (
    <div>
      <SectionHeader eyebrow="Match Complete" title={`${teamA.name} vs ${teamB.name}`} />
      <SeamDivider />
      <Card className="p-6 text-center mb-6">
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <div className="text-sm text-mutedDim">{team1Name}</div>
            <div className="text-2xl font-bold font-display">{s1.totalRuns}/{s1.totalWickets}</div>
            <div className="text-xs text-mutedDim">{formatOvers(s1.legalBalls)} ov</div>
          </div>
          <div>
            <div className="text-sm text-mutedDim">{team2Name}</div>
            <div className="text-2xl font-bold font-display">{s2.totalRuns}/{s2.totalWickets}</div>
            <div className="text-xs text-mutedDim">{formatOvers(s2.legalBalls)} ov</div>
          </div>
        </div>
        <Badge tone="gold">{match.is_tie ? "Match Tied" : match.margin ? `Winner by ${match.margin}` : "Result Pending"}</Badge>
      </Card>
    </div>
  );
}
