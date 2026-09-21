"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { computeInningsState, allowedWicketTypes, buildCommentary, SHOT_ZONES, type BallRow } from "@/lib/scoring";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const SCORE_ROLES = ["Super Admin", "Tournament Admin", "Scorer"];

async function guard(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SCORE_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin, Tournament Admin or Scorer can score matches." };
  }
  return { profile };
}

// Editing or deleting past balls, resetting a match and changing results.
async function superGuard(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "Super Admin") {
    return { error: "Only Super Admin can do this." };
  }
  return { profile };
}

// Overs and all-out rule for an innings. Overs come from this match's setup
// (falling back to the tournament-wide setting); a team is all out when only
// one batter is left, i.e. after (Playing XI size - 1) wickets.
async function getRules(supabase: any, matchId: string, battingTeamId: string) {
  const [{ data: s }, { data: m }, { count }] = await Promise.all([
    supabase.from("tournament_settings").select("playing_xi, number_of_overs").eq("id", 1).single(),
    supabase.from("matches").select("overs_per_innings").eq("id", matchId).single(),
    supabase.from("match_players").select("id", { count: "exact", head: true }).eq("match_id", matchId).eq("team_id", battingTeamId),
  ]);
  const xiSize: number = count && count >= 2 ? count : (s?.playing_xi ?? 11);
  return { xiSize, maxWickets: xiSize - 1, oversLimit: (m?.overs_per_innings ?? s?.number_of_overs ?? 16) as number };
}

function fmtOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function revalidateMatch(matchId: string) {
  revalidatePath(`/admin/scoring/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/admin/fixtures");
  revalidatePath("/standings");
}

async function nextSequence(supabase: any, inningsId: string): Promise<number> {
  const { data } = await supabase.from("balls").select("sequence_no").eq("innings_id", inningsId).order("sequence_no", { ascending: false }).limit(1).maybeSingle();
  return (data?.sequence_no ?? 0) + 1;
}

async function handleInningsCompletion(supabase: any, matchId: string, innings: any, state: any) {
  // Innings 1 ending just waits for the scorer to start innings 2.
  if (innings.innings_number !== 2) return;

  // Innings 2 complete — finalise the match and sync the result into
  // `matches` so the public Standings/Points Table picks it up automatically.
  const { data: innings1 } = await supabase.from("innings").select("*").eq("match_id", matchId).eq("innings_number", 1).single();
  const { maxWickets } = await getRules(supabase, matchId, innings.batting_team_id);

  const team1Runs = innings1.total_runs, team1Wkts = innings1.total_wickets, team1Balls = innings1.legal_balls;
  const team2Runs = state.totalRuns, team2Wkts = state.totalWickets, team2Balls = state.legalBalls;
  // A revised (rain) target can differ from innings 1 + 1.
  const target: number = innings.target ?? team1Runs + 1;

  let winnerId: string | null = null;
  let margin = "";
  let isTie = false;

  if (team2Runs >= target) {
    winnerId = innings1.bowling_team_id;
    const wicketsInHand = Math.max(0, maxWickets - team2Wkts);
    margin = `${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
  } else if (team2Runs < target - 1) {
    winnerId = innings1.batting_team_id;
    const diff = target - 1 - team2Runs;
    margin = `${diff} run${diff === 1 ? "" : "s"}`;
  } else {
    isTie = true;
  }

  const { data: match } = await supabase.from("matches").select("team_a_id, team_b_id").eq("id", matchId).single();
  const isInnings1TeamA = match.team_a_id === innings1.batting_team_id;

  await supabase.from("matches").update({
    status: "Completed",
    team_a_score: isInnings1TeamA ? `${team1Runs}/${team1Wkts}` : `${team2Runs}/${team2Wkts}`,
    team_a_overs: Number(fmtOvers(isInnings1TeamA ? team1Balls : team2Balls)),
    team_b_score: isInnings1TeamA ? `${team2Runs}/${team2Wkts}` : `${team1Runs}/${team1Wkts}`,
    team_b_overs: Number(fmtOvers(isInnings1TeamA ? team2Balls : team1Balls)),
    winner_id: winnerId,
    is_tie: isTie,
    result_type: isTie ? "Tie" : "Normal",
    margin: margin || null,
    batting_first_id: innings1.batting_team_id,
  }).eq("id", matchId);
}

async function recomputeAndPersist(supabase: any, inningsId: string, matchId: string) {
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  const { data: balls } = await supabase.from("balls").select("*").eq("innings_id", inningsId).order("sequence_no");
  const rules = await getRules(supabase, matchId, innings.batting_team_id);
  const oversLimit: number = innings.overs_limit ?? rules.oversLimit;

  const state = computeInningsState(
    (balls ?? []) as BallRow[],
    { striker: innings.opening_striker_id, nonStriker: innings.opening_non_striker_id, bowler: innings.opening_bowler_id },
    rules.maxWickets, oversLimit
  );

  const targetReachedEarly = innings.innings_number === 2 && innings.target && state.totalRuns >= innings.target;
  const isComplete = state.isInningsComplete || !!targetReachedEarly || !!innings.declared;

  await supabase.from("innings").update({
    total_runs: state.totalRuns,
    total_wickets: state.totalWickets,
    legal_balls: state.legalBalls,
    extras_wide: state.extras.wide,
    extras_no_ball: state.extras.no_ball,
    extras_bye: state.extras.bye,
    extras_leg_bye: state.extras.leg_bye,
    extras_penalty: state.extras.penalty,
    current_striker_id: state.striker,
    current_non_striker_id: state.nonStriker,
    current_bowler_id: state.bowler,
    last_over_bowler_id: state.lastOverBowler,
    is_free_hit: state.isFreeHit,
    status: isComplete ? "Completed" : "In Progress",
  }).eq("id", inningsId);

  if (isComplete) {
    await handleInningsCompletion(supabase, matchId, innings, state);
  }

  return { ...state, isInningsComplete: isComplete };
}

// After a past ball is edited or deleted: renumber the ball log, rebuild
// both innings, keep innings 2's target in step with innings 1, and re-open
// the match if the result no longer stands.
async function recomputeMatch(supabase: any, matchId: string) {
  const { data: all } = await supabase.from("innings").select("*").eq("match_id", matchId).order("innings_number");
  const inn1 = (all ?? []).find((i: any) => i.innings_number === 1);
  const inn2 = (all ?? []).find((i: any) => i.innings_number === 2);

  if (inn1) {
    await renumberInnings(supabase, inn1.id);
    const s1 = await recomputeAndPersist(supabase, inn1.id, matchId);
    // Move the target with innings 1, unless it was revised by hand (rain).
    if (inn2 && (inn2.target === null || inn2.target === inn1.total_runs + 1)) {
      await supabase.from("innings").update({ target: s1.totalRuns + 1 }).eq("id", inn2.id);
    }
  }
  if (inn2 && inn2.opening_striker_id) {
    await renumberInnings(supabase, inn2.id);
    const s2 = await recomputeAndPersist(supabase, inn2.id, matchId);
    if (!s2.isInningsComplete) {
      await supabase.from("matches").update({ status: "Live", winner_id: null, is_tie: false, margin: null, result_type: null }).eq("id", matchId);
    }
  } else if (inn1) {
    await supabase.from("matches").update({ status: "Live", winner_id: null, is_tie: false, margin: null, result_type: null }).eq("id", matchId);
  }
}

// Keeps sequence numbers gap-free and over/ball numbers correct after edits.
async function renumberInnings(supabase: any, inningsId: string) {
  const { data: balls } = await supabase.from("balls").select("id, sequence_no, over_number, ball_in_over, extra_type, event_type").eq("innings_id", inningsId).order("sequence_no");
  let legal = 0;
  let seq = 0;
  for (const b of balls ?? []) {
    seq += 1;
    const over = Math.floor(legal / 6);
    const ballInOver = (legal % 6) + 1;
    if (b.sequence_no !== seq || b.over_number !== over || b.ball_in_over !== ballInOver) {
      await supabase.from("balls").update({ sequence_no: seq, over_number: over, ball_in_over: ballInOver }).eq("id", b.id);
    }
    const isLegal = !b.event_type && b.extra_type !== "wide" && b.extra_type !== "no_ball";
    if (isLegal) legal += 1;
  }
}

async function playerNames(supabase: any, ids: (string | null)[]) {
  const clean = ids.filter(Boolean) as string[];
  if (!clean.length) return (_: string | null) => "—";
  const { data: people } = await supabase.from("players").select("id, full_name").in("id", clean);
  return (id: string | null) => (people ?? []).find((p: any) => p.id === id)?.full_name || "—";
}

export async function saveMatchSetup(matchId: string, payload: {
  oversPerInnings: number; maxOversPerBowler: number | null; tossWinnerId: string; tossDecision: string;
  cricheroesUrl: string;
  xi: { playerId: string; teamId: string; isCaptain: boolean; isWicketKeeper: boolean }[];
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: match } = await supabase.from("matches").select("team_a_id, team_b_id").eq("id", matchId).single();
  if (!match) return { error: "Match not found." };

  const { count: startedCount } = await supabase.from("innings").select("id", { count: "exact", head: true })
    .eq("match_id", matchId).not("opening_striker_id", "is", null);
  const started = !!startedCount;

  if (started && g.profile.role !== "Super Admin") {
    return { error: "This match has already started. Only Super Admin can change the Playing XI now." };
  }

  for (const teamId of [match.team_a_id, match.team_b_id]) {
    if (payload.xi.filter((p) => p.teamId === teamId).length < 2) {
      return { error: "Select at least 2 players in each team's Playing XI." };
    }
  }

  if (started) {
    // Anyone who has already batted or bowled must stay in the Playing XI.
    const { data: inns } = await supabase.from("innings").select("id").eq("match_id", matchId);
    const inningsIds = (inns ?? []).map((i: any) => i.id);
    const { data: used } = await supabase.from("balls").select("striker_id, non_striker_id, bowler_id, new_batsman_id").in("innings_id", inningsIds);
    const usedIds = new Set<string>();
    for (const b of used ?? []) for (const id of [b.striker_id, b.non_striker_id, b.bowler_id, b.new_batsman_id]) if (id) usedIds.add(id);
    const keptIds = new Set(payload.xi.map((p) => p.playerId));
    const dropped = Array.from(usedIds).filter((id) => !keptIds.has(id));
    if (dropped.length) {
      const nameOf = await playerNames(supabase, dropped);
      return { error: `${dropped.map(nameOf).join(", ")} already batted or bowled in this match, so they must stay in the Playing XI.` };
    }
  } else {
    if (!Number.isFinite(payload.oversPerInnings) || payload.oversPerInnings < 1) {
      return { error: "Enter the number of overs per innings." };
    }
    if (payload.maxOversPerBowler !== null && (!Number.isFinite(payload.maxOversPerBowler) || payload.maxOversPerBowler < 1)) {
      return { error: "Max overs per bowler must be at least 1, or left empty for no limit." };
    }
    if (!payload.tossWinnerId || !["Bat", "Bowl"].includes(payload.tossDecision)) {
      return { error: "Select who won the toss and what they chose." };
    }

    const otherTeamId = payload.tossWinnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
    const battingFirstId = payload.tossDecision === "Bat" ? payload.tossWinnerId : otherTeamId;

    const { error } = await supabase.from("matches").update({
      overs_per_innings: payload.oversPerInnings,
      max_overs_per_bowler: payload.maxOversPerBowler,
      toss_winner_id: payload.tossWinnerId,
      toss_decision: payload.tossDecision,
      batting_first_id: battingFirstId,
      cricheroes_url: payload.cricheroesUrl.trim() || null,
    }).eq("id", matchId);
    if (error) return { error: error.message };
  }

  const { error: delError } = await supabase.from("match_players").delete().eq("match_id", matchId);
  if (delError) return { error: delError.message };

  const { error: xiError } = await supabase.from("match_players").insert(
    payload.xi.map((p) => ({
      match_id: matchId, team_id: p.teamId, player_id: p.playerId,
      is_captain: p.isCaptain, is_wicket_keeper: p.isWicketKeeper,
    }))
  );
  if (xiError) return { error: xiError.message };

  await logAudit({ action: started ? "Playing XI Changed" : "Match Setup Saved", entity: "Match", entityId: matchId, field: "setup", newValue: started ? "Playing XI" : `${payload.oversPerInnings} overs` });
  revalidateMatch(matchId);
  return { ok: true };
}

export async function startInnings(payload: {
  matchId: string; inningsNumber: number; battingTeamId: string; bowlingTeamId: string;
  strikerId: string; nonStrikerId: string; bowlerId: string;
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();

  // Remove an empty placeholder innings (the earlier version auto-created
  // innings 2 without openers) so it can be started properly.
  await supabase.from("innings").delete()
    .eq("match_id", payload.matchId).eq("innings_number", payload.inningsNumber).is("opening_striker_id", null);

  let target: number | null = null;
  if (payload.inningsNumber === 2) {
    const { data: inn1 } = await supabase.from("innings").select("total_runs").eq("match_id", payload.matchId).eq("innings_number", 1).single();
    target = (inn1?.total_runs ?? 0) + 1;
  }

  const { data: m } = await supabase.from("matches").select("overs_per_innings").eq("id", payload.matchId).single();

  const { data, error } = await supabase.from("innings").insert({
    match_id: payload.matchId,
    innings_number: payload.inningsNumber,
    batting_team_id: payload.battingTeamId,
    bowling_team_id: payload.bowlingTeamId,
    opening_striker_id: payload.strikerId,
    opening_non_striker_id: payload.nonStrikerId,
    opening_bowler_id: payload.bowlerId,
    current_striker_id: payload.strikerId,
    current_non_striker_id: payload.nonStrikerId,
    current_bowler_id: payload.bowlerId,
    overs_limit: m?.overs_per_innings ?? null,
    target,
  }).select().single();
  if (error) return { error: error.message };

  await supabase.from("matches").update({ status: "Live" }).eq("id", payload.matchId);
  await logAudit({ action: "Innings Started", entity: "Match", entityId: payload.matchId, field: "innings", newValue: payload.inningsNumber });

  revalidateMatch(payload.matchId);
  return { ok: true, innings: data };
}

export async function recordBall(inningsId: string, matchId: string, payload: {
  runsOffBat: number; extraType: string | null; extraRuns: number;
  isWicket: boolean; wicketType: string | null; dismissedPlayerId: string | null;
  fielderId: string | null; newBatsmanId: string | null; shotZone: string | null;
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  if (!innings) return { error: "Innings not found." };
  if (innings.status === "Completed") return { error: "This innings has already ended." };

  if (payload.isWicket && payload.wicketType) {
    const allowed = allowedWicketTypes(payload.extraType as any, innings.is_free_hit);
    if (!allowed.includes(payload.wicketType)) {
      return { error: `${payload.wicketType} is not a valid dismissal on this delivery${innings.is_free_hit ? " (free hit)" : ""}.` };
    }
  }

  const overNumber = Math.floor(innings.legal_balls / 6);
  const ballInOver = (innings.legal_balls % 6) + 1;

  const dismissedId = payload.isWicket ? (payload.dismissedPlayerId || innings.current_striker_id) : null;
  const nameOf = await playerNames(supabase, [innings.current_striker_id, innings.current_bowler_id, dismissedId, payload.fielderId]);
  const zone = SHOT_ZONES.find((z) => z.key === payload.shotZone) || null;

  const commentary = buildCommentary({
    bowler: nameOf(innings.current_bowler_id),
    batter: nameOf(innings.current_striker_id),
    runsOffBat: payload.runsOffBat,
    extraType: payload.extraType as any,
    extraRuns: payload.extraRuns,
    isWicket: payload.isWicket,
    wicketType: payload.wicketType,
    dismissed: nameOf(dismissedId),
    fielder: payload.fielderId ? nameOf(payload.fielderId) : null,
    zone: zone?.label ?? null,
    isFreeHit: innings.is_free_hit,
  });

  const { error } = await supabase.from("balls").insert({
    innings_id: inningsId,
    sequence_no: await nextSequence(supabase, inningsId),
    over_number: overNumber,
    ball_in_over: ballInOver,
    striker_id: innings.current_striker_id,
    non_striker_id: innings.current_non_striker_id,
    bowler_id: innings.current_bowler_id,
    runs_off_bat: payload.runsOffBat,
    extra_type: payload.extraType,
    extra_runs: payload.extraRuns,
    is_wicket: payload.isWicket,
    wicket_type: payload.wicketType,
    dismissed_player_id: dismissedId,
    fielder_id: payload.fielderId,
    new_batsman_id: payload.newBatsmanId,
    is_free_hit: innings.is_free_hit,
    shot_x: zone?.x ?? null,
    shot_y: zone?.y ?? null,
    commentary,
  });
  if (error) return { error: error.message };

  await recomputeAndPersist(supabase, inningsId, matchId);

  revalidateMatch(matchId);
  return { ok: true };
}

export async function undoLastBall(inningsId: string, matchId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("declared, innings_number").eq("id", inningsId).single();

  if (innings?.declared) {
    // Undo "End innings" first, before any ball.
    await supabase.from("innings").update({ declared: false, status: "In Progress" }).eq("id", inningsId);
  } else {
    const { data: lastBall } = await supabase.from("balls").select("id").eq("innings_id", inningsId).order("sequence_no", { ascending: false }).limit(1).maybeSingle();
    if (!lastBall) return { error: "No balls to undo." };
    await supabase.from("balls").delete().eq("id", lastBall.id);
    await supabase.from("innings").update({ status: "In Progress" }).eq("id", inningsId);
  }

  const state = await recomputeAndPersist(supabase, inningsId, matchId);

  if (!state.isInningsComplete) {
    if (innings?.innings_number === 1) {
      const { data: inn2 } = await supabase.from("innings").select("id").eq("match_id", matchId).eq("innings_number", 2).maybeSingle();
      if (inn2) {
        const { count } = await supabase.from("balls").select("*", { count: "exact", head: true }).eq("innings_id", inn2.id);
        if (!count) await supabase.from("innings").delete().eq("id", inn2.id);
      }
    }
    await supabase.from("matches").update({ status: "Live", winner_id: null, is_tie: false, margin: null, result_type: null }).eq("id", matchId);
  }

  revalidateMatch(matchId);
  return { ok: true };
}

// New bowler at the start of an over, or mid-over (injury etc.).
export async function setNewBowler(inningsId: string, matchId: string, bowlerId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("last_over_bowler_id, legal_balls, current_bowler_id").eq("id", inningsId).single();
  if (innings?.last_over_bowler_id === bowlerId && innings.legal_balls > 0) {
    return { error: "The same bowler cannot bowl consecutive overs." };
  }
  await supabase.from("innings").update({ current_bowler_id: bowlerId }).eq("id", inningsId);
  revalidatePath(`/admin/scoring/${matchId}`);
  return { ok: true };
}

export async function swapStrike(inningsId: string, matchId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("current_striker_id, current_non_striker_id").eq("id", inningsId).single();
  if (!innings) return { error: "Innings not found." };
  await supabase.from("innings").update({
    current_striker_id: innings.current_non_striker_id,
    current_non_striker_id: innings.current_striker_id,
  }).eq("id", inningsId);
  revalidatePath(`/admin/scoring/${matchId}`);
  return { ok: true };
}

export async function retireBatter(inningsId: string, matchId: string, payload: {
  playerId: string; type: "Retired Hurt" | "Retired Out"; newBatsmanId: string | null;
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  if (!innings) return { error: "Innings not found." };
  if (innings.status === "Completed") return { error: "This innings has already ended." };
  if (![innings.current_striker_id, innings.current_non_striker_id].includes(payload.playerId)) {
    return { error: "Only a batter at the crease can retire." };
  }

  const nameOf = await playerNames(supabase, [payload.playerId, payload.newBatsmanId]);
  const commentary = `${nameOf(payload.playerId)} ${payload.type === "Retired Out" ? "is retired out" : "retires hurt"}${payload.newBatsmanId ? `. ${nameOf(payload.newBatsmanId)} comes to the crease` : ""}`;

  const { error } = await supabase.from("balls").insert({
    innings_id: inningsId,
    sequence_no: await nextSequence(supabase, inningsId),
    over_number: Math.floor(innings.legal_balls / 6),
    ball_in_over: (innings.legal_balls % 6) + 1,
    event_type: "retired",
    striker_id: innings.current_striker_id,
    non_striker_id: innings.current_non_striker_id,
    bowler_id: innings.current_bowler_id,
    runs_off_bat: 0,
    extra_type: null,
    extra_runs: 0,
    is_wicket: payload.type === "Retired Out",
    wicket_type: payload.type,
    dismissed_player_id: payload.playerId,
    new_batsman_id: payload.newBatsmanId,
    is_free_hit: innings.is_free_hit,
    commentary,
  });
  if (error) return { error: error.message };

  // Keep who's in and who's bowling exactly as it was, apart from the swap-in.
  await recomputeAndPersist(supabase, inningsId, matchId);
  await supabase.from("innings").update({ current_bowler_id: innings.current_bowler_id }).eq("id", inningsId);

  revalidateMatch(matchId);
  return { ok: true };
}

// Rain etc.: change this innings' overs, and (innings 2) the revised target.
export async function setInningsOvers(inningsId: string, matchId: string, overs: number, target: number | null): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  if (!Number.isInteger(overs) || overs < 1) return { error: "Enter a whole number of overs (at least 1)." };

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  if (!innings) return { error: "Innings not found." };
  if (overs * 6 < innings.legal_balls) return { error: `${fmtOvers(innings.legal_balls)} overs have already been bowled.` };
  if (target !== null && (!Number.isInteger(target) || target < 1)) return { error: "Enter a valid target." };

  const patch: any = { overs_limit: overs };
  if (innings.innings_number === 2 && target !== null) patch.target = target;
  await supabase.from("innings").update(patch).eq("id", inningsId);
  if (innings.innings_number === 1) {
    // Innings 2 will start with the same reduced overs.
    await supabase.from("matches").update({ overs_per_innings: overs }).eq("id", matchId);
  }

  await logAudit({ action: "Overs Changed", entity: "Match", entityId: matchId, field: `innings ${innings.innings_number}`, previousValue: innings.overs_limit, newValue: overs });
  await recomputeAndPersist(supabase, inningsId, matchId);
  revalidateMatch(matchId);
  return { ok: true };
}

export async function endInnings(inningsId: string, matchId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  await supabase.from("innings").update({ declared: true }).eq("id", inningsId);
  await recomputeAndPersist(supabase, inningsId, matchId);
  await logAudit({ action: "Innings Ended Early", entity: "Match", entityId: matchId, field: "innings", newValue: inningsId });
  revalidateMatch(matchId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Super Admin controls
// ---------------------------------------------------------------------------

export async function editBall(ballId: string, matchId: string, payload: {
  runsOffBat: number; extraType: string | null; extraRuns: number; wicketType: string | null; fielderId: string | null;
}): Promise<any> {
  const g: any = await superGuard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: ball } = await supabase.from("balls").select("*").eq("id", ballId).single();
  if (!ball) return { error: "Ball not found." };
  if (ball.event_type) return { error: "This entry isn't a delivery. Delete it instead." };

  if (ball.is_wicket) {
    if (!payload.wicketType) return { error: "Select the dismissal type." };
    const allowed = allowedWicketTypes(payload.extraType as any, ball.is_free_hit);
    if (!allowed.includes(payload.wicketType)) return { error: `${payload.wicketType} is not valid on this delivery.` };
  }

  const nameOf = await playerNames(supabase, [ball.striker_id, ball.bowler_id, ball.dismissed_player_id, payload.fielderId]);
  const zone = SHOT_ZONES.find((z) => z.x === Number(ball.shot_x) && z.y === Number(ball.shot_y)) || null;
  const commentary = buildCommentary({
    bowler: nameOf(ball.bowler_id),
    batter: nameOf(ball.striker_id),
    runsOffBat: payload.runsOffBat,
    extraType: payload.extraType as any,
    extraRuns: payload.extraRuns,
    isWicket: ball.is_wicket,
    wicketType: ball.is_wicket ? payload.wicketType : null,
    dismissed: nameOf(ball.dismissed_player_id),
    fielder: payload.fielderId ? nameOf(payload.fielderId) : null,
    zone: zone?.label ?? null,
    isFreeHit: ball.is_free_hit,
  });

  const { error } = await supabase.from("balls").update({
    runs_off_bat: payload.runsOffBat,
    extra_type: payload.extraType,
    extra_runs: payload.extraRuns,
    wicket_type: ball.is_wicket ? payload.wicketType : null,
    fielder_id: ball.is_wicket ? payload.fielderId : null,
    commentary,
  }).eq("id", ballId);
  if (error) return { error: error.message };

  await logAudit({ action: "Ball Edited", entity: "Match", entityId: matchId, field: `ball ${ball.over_number}.${ball.ball_in_over}`, previousValue: ball.commentary, newValue: commentary });
  await recomputeMatch(supabase, matchId);
  revalidateMatch(matchId);
  return { ok: true };
}

export async function deleteBall(ballId: string, matchId: string): Promise<any> {
  const g: any = await superGuard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: ball } = await supabase.from("balls").select("*").eq("id", ballId).single();
  if (!ball) return { error: "Ball not found." };

  const { error } = await supabase.from("balls").delete().eq("id", ballId);
  if (error) return { error: error.message };
  await supabase.from("innings").update({ status: "In Progress" }).eq("id", ball.innings_id);

  await logAudit({ action: "Ball Deleted", entity: "Match", entityId: matchId, field: `ball ${ball.over_number}.${ball.ball_in_over}`, previousValue: ball.commentary, newValue: "—" });
  await recomputeMatch(supabase, matchId);
  revalidateMatch(matchId);
  return { ok: true };
}

export async function resetMatch(matchId: string): Promise<any> {
  const g: any = await superGuard();
  if (g.error) return g;

  const supabase = createClient();
  const { error } = await supabase.from("innings").delete().eq("match_id", matchId);
  if (error) return { error: error.message };

  await supabase.from("matches").update({
    status: "Scheduled", team_a_score: null, team_a_overs: null, team_b_score: null, team_b_overs: null,
    winner_id: null, is_tie: false, margin: null, result_type: null, man_of_match: null, man_of_match_player_id: null,
  }).eq("id", matchId);

  await logAudit({ action: "Match Scoring Reset", entity: "Match", entityId: matchId, field: "scoring", newValue: "reset" });
  revalidateMatch(matchId);
  return { ok: true };
}

export async function updateResult(matchId: string, payload: {
  resultType: "Normal" | "Tie" | "No Result" | "Abandoned"; winnerId: string | null; margin: string; manOfMatchPlayerId: string | null;
}): Promise<any> {
  const g: any = await superGuard();
  if (g.error) return g;

  if (payload.resultType === "Normal" && !payload.winnerId) return { error: "Select the winning team." };

  const supabase = createClient();
  const nameOf = await playerNames(supabase, [payload.manOfMatchPlayerId]);
  const noWinner = payload.resultType !== "Normal";

  const { error } = await supabase.from("matches").update({
    status: payload.resultType === "Abandoned" ? "Abandoned" : "Completed",
    result_type: payload.resultType,
    winner_id: noWinner ? null : payload.winnerId,
    // Tie and No Result both earn 1 point each in the points table.
    is_tie: payload.resultType === "Tie" || payload.resultType === "No Result",
    margin: noWinner ? null : payload.margin.trim() || null,
    man_of_match_player_id: payload.manOfMatchPlayerId,
    man_of_match: payload.manOfMatchPlayerId ? nameOf(payload.manOfMatchPlayerId) : null,
  }).eq("id", matchId);
  if (error) return { error: error.message };

  await logAudit({ action: "Match Result Edited", entity: "Match", entityId: matchId, field: "result", newValue: payload.resultType });
  revalidateMatch(matchId);
  return { ok: true };
}
