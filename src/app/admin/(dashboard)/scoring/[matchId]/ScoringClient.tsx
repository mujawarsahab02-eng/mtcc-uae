"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { computeInningsState, formatOvers, type BallRow } from "@/lib/scoring";
import { startInnings, undoLastBall } from "./actions";
import MatchSetup from "./MatchSetup";
import LiveScoring from "./LiveScoring";
import AdminPanel from "./AdminPanel";
import { ScorecardView, type InningsView } from "./MatchTabs";

type Player = { id: string; full_name: string; team_id: string };
type XiRow = { player_id: string; team_id: string; is_captain: boolean; is_wicket_keeper: boolean };

export default function ScoringClient({
  match, teamA, teamB, squadA, squadB, xiRows, settings,
  initialInnings1, initialInnings2, initialBalls1, initialBalls2, canScore, isSuperAdmin,
}: {
  match: any; teamA: any; teamB: any; squadA: Player[]; squadB: Player[]; xiRows: XiRow[];
  settings: { playingXI: number; oversLimit: number };
  initialInnings1: any; initialInnings2: any; initialBalls1: any[]; initialBalls2: any[];
  canScore: boolean; isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editingSetup, setEditingSetup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

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
  const teamName = (id: string | null) => (id === teamA.id ? teamA.name : id === teamB.id ? teamB.name : "—");

  // The Playing XI from Match Setup, or the whole squad if none was picked.
  const xiFor = (teamId: string, squad: Player[]) => {
    const ids = xiRows.filter((r) => r.team_id === teamId).map((r) => r.player_id);
    return ids.length ? squad.filter((p) => ids.includes(p.id)) : squad;
  };
  const playingA = xiFor(teamA.id, squadA);
  const playingB = xiFor(teamB.id, squadB);
  const playingFor = (teamId: string) => (teamId === teamA.id ? playingA : playingB);
  // All out when only one batter is left.
  const maxWicketsFor = (teamId: string) => {
    const n = xiRows.filter((r) => r.team_id === teamId).length;
    return (n >= 2 ? n : settings.playingXI) - 1;
  };

  const innings1 = initialInnings1;
  // Ignore an empty placeholder innings 2 left by the earlier version until it's started properly.
  const innings2 = initialInnings2 && initialInnings2.opening_striker_id ? initialInnings2 : null;

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
  if (innings1) views.push(makeView(innings1, initialBalls1));
  if (innings2) views.push(makeView(innings2, initialBalls2));

  const adminToggle = isSuperAdmin && innings1 ? (
    <div className="flex justify-end mb-3">
      <Button variant="subtle" size="sm" onClick={() => setShowAdmin(!showAdmin)}>{showAdmin ? "← Back to scoring" : "🛠 Match controls"}</Button>
    </div>
  ) : null;

  if (showAdmin && isSuperAdmin && innings1) {
    return (
      <div>
        {adminToggle}
        <AdminPanel
          match={match} teamA={teamA} teamB={teamB} views={views}
          squadA={squadA} squadB={squadB} playingA={playingA} playingB={playingB}
          xiRows={xiRows} settings={settings} playerName={playerName}
        />
      </div>
    );
  }

  // Finished: innings 2 done, or the result was set by hand (No Result / Abandoned).
  const nothingInProgress = innings1?.status !== "In Progress" && innings2?.status !== "In Progress";
  const matchOver = !!innings1 && (innings2?.status === "Completed" || match.status === "Abandoned" || (match.status === "Completed" && nothingInProgress));

  if (matchOver) {
    return (
      <div>
        {adminToggle}
        <MatchSummary match={match} teamA={teamA} teamB={teamB} views={views} innings2={innings2} playerName={playerName} canScore={canScore} />
      </div>
    );
  }

  if (!innings1) {
    if (!match.overs_per_innings || editingSetup) {
      if (!canScore) return <Card className="p-8 text-center text-sm text-mutedDim">This match hasn't started yet.</Card>;
      return (
        <MatchSetup
          match={match} teamA={teamA} teamB={teamB} squadA={squadA} squadB={squadB} xiRows={xiRows} settings={settings}
          onSaved={() => setEditingSetup(false)}
          onCancel={match.overs_per_innings ? () => setEditingSetup(false) : undefined}
        />
      );
    }
    return (
      <StartInningsForm
        match={match} inningsNumber={1} teamA={teamA} teamB={teamB} squadA={playingA} squadB={playingB}
        defaultBattingTeamId={match.batting_first_id} lockBattingTeam={!!match.batting_first_id}
        onEditSetup={canScore ? () => setEditingSetup(true) : undefined}
      />
    );
  }

  if (innings1.status === "Completed" && !innings2) {
    return (
      <div>
        {adminToggle}
        <Card className="p-5 mb-4">
          <div className="text-xs font-bold uppercase text-mutedDim mb-1">Innings 1 complete</div>
          <div className="text-2xl font-bold font-display">
            {views[0].battingName}: {views[0].state.totalRuns}/{views[0].state.totalWickets}{" "}
            <span className="text-base text-mutedDim">({formatOvers(views[0].state.legalBalls)} ov)</span>
          </div>
        </Card>
        {canScore && <UndoBar inningsId={innings1.id} matchId={match.id} label={innings1.declared ? "Undo “End innings”" : "Undo last ball of Innings 1"} />}
        <StartInningsForm
          match={match} inningsNumber={2} teamA={teamA} teamB={teamB} squadA={playingA} squadB={playingB}
          defaultBattingTeamId={innings1.bowling_team_id} lockBattingTeam target={innings1.total_runs + 1}
        />
        <div className="mt-4"><ScorecardView views={views} playerName={playerName} /></div>
      </div>
    );
  }

  const active = innings1.status === "In Progress" ? views[0]
    : innings2 && innings2.status === "In Progress" ? views[1]
    : null;

  if (active) {
    return (
      <div>
        {adminToggle}
        <LiveScoring
          match={match} teamA={teamA} teamB={teamB}
          view={active} views={views}
          battingSquad={playingFor(active.innings.batting_team_id)}
          bowlingSquad={playingFor(active.innings.bowling_team_id)}
          maxWickets={maxWicketsFor(active.innings.batting_team_id)}
          maxBowlerOvers={match.max_overs_per_bowler}
          playerName={playerName} canScore={canScore}
        />
      </div>
    );
  }

  return <Card className="p-8 text-center text-sm text-mutedDim">Loading match state…</Card>;
}

function StartInningsForm({ match, inningsNumber, teamA, teamB, squadA, squadB, defaultBattingTeamId, lockBattingTeam, target, onEditSetup }: any) {
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
      setErr("Select two different opening batters and an opening bowler.");
      return;
    }
    setBusy(true); setErr("");
    const res: any = await startInnings({
      matchId: match.id, inningsNumber, battingTeamId, bowlingTeamId: battingTeamId === teamA.id ? teamB.id : teamA.id,
      strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler,
    });
    setBusy(false);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  const tossWinnerName = match.toss_winner_id === teamA.id ? teamA.name : match.toss_winner_id === teamB.id ? teamB.name : null;

  return (
    <Card className="p-5">
      <SectionHeader eyebrow="Live Scoring" title={`Start Innings ${inningsNumber}`} />
      <SeamDivider />
      {inningsNumber === 1 && (
        <div className="text-xs text-mutedDim mb-4">
          {match.overs_per_innings} overs per innings
          {match.max_overs_per_bowler ? `, max ${match.max_overs_per_bowler} per bowler` : ""}
          {tossWinnerName ? `. ${tossWinnerName} won the toss and chose to ${match.toss_decision === "Bat" ? "bat" : "bowl"}.` : ""}
        </div>
      )}
      {target && <div className="text-sm text-goldBright font-semibold mb-4">Target: {target} runs</div>}
      <Field label="Batting Team">
        {lockBattingTeam ? (
          <div className="text-sm font-semibold py-2">{battingTeamId === teamA.id ? teamA.name : teamB.name}</div>
        ) : (
          <select value={battingTeamId} onChange={(e: any) => setBattingTeamId(e.target.value)}>
            <option value={teamA.id}>{teamA.name}</option>
            <option value={teamB.id}>{teamB.name}</option>
          </select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Striker (on strike)">
          <select value={striker} onChange={(e: any) => setStriker(e.target.value)}>
            <option value="">Select</option>
            {battingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <Field label="Non-Striker">
          <select value={nonStriker} onChange={(e: any) => setNonStriker(e.target.value)}>
            <option value="">Select</option>
            {battingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Opening Bowler">
        <select value={bowler} onChange={(e: any) => setBowler(e.target.value)}>
          <option value="">Select</option>
          {bowlingSquad.map((p: Player) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </Field>
      {err && <div className="text-xs mb-3 text-red">{err}</div>}
      <Button variant="primary" className="w-full" onClick={handleStart} disabled={busy}>{busy ? "Starting…" : `Start Innings ${inningsNumber}`}</Button>
      {onEditSetup && <Button variant="subtle" size="sm" className="w-full mt-2" onClick={onEditSetup}>Edit Match Setup</Button>}
    </Card>
  );
}

function UndoBar({ inningsId, matchId, label }: { inningsId: string; matchId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    if (!window.confirm("Undo? This re-opens the innings.")) return;
    setBusy(true); setErr("");
    const res: any = await undoLastBall(inningsId, matchId);
    setBusy(false);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="mb-4">
      <Button variant="subtle" size="sm" className="w-full" onClick={run} disabled={busy}>{busy ? "Undoing…" : label}</Button>
      {err && <div className="text-xs mt-2 text-red">{err}</div>}
    </div>
  );
}

function MatchSummary({ match, teamA, teamB, views, innings2, playerName, canScore }: any) {
  const winnerName = match.winner_id === teamA.id ? teamA.name : match.winner_id === teamB.id ? teamB.name : null;
  const result = match.status === "Abandoned" ? "Match Abandoned"
    : match.result_type === "No Result" ? "No Result"
    : match.is_tie ? "Match Tied"
    : winnerName ? `${winnerName} won${match.margin ? ` by ${match.margin}` : ""}` : "Result Pending";

  return (
    <div>
      <SectionHeader eyebrow="Match Complete" title={`${teamA.name} vs ${teamB.name}`} />
      <SeamDivider />
      <Card className="p-6 text-center mb-4">
        <div className="grid grid-cols-2 gap-6 mb-4">
          {views.map((v: InningsView) => (
            <div key={v.innings.id}>
              <div className="text-sm text-mutedDim">{v.battingName}</div>
              <div className="text-2xl font-bold font-display">{v.state.totalRuns}/{v.state.totalWickets}</div>
              <div className="text-xs text-mutedDim">{formatOvers(v.state.legalBalls)} ov</div>
            </div>
          ))}
        </div>
        <Badge tone="gold">{result}</Badge>
        {match.man_of_match && <div className="text-xs text-mutedDim mt-3">Man of the Match: <b className="text-ink">{match.man_of_match}</b></div>}
      </Card>
      {canScore && innings2 && <UndoBar inningsId={innings2.id} matchId={match.id} label={innings2.declared ? "Undo “End innings” (re-opens the match)" : "Undo last ball (re-opens the match)"} />}
      <ScorecardView views={views} playerName={playerName} />
    </div>
  );
}
