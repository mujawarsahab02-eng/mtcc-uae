"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { computeInningsState, allowedWicketTypes, type BallRow } from "@/lib/scoring";
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

async function getSettings(supabase: any) {
  const { data } = await supabase.from("tournament_settings").select("playing_xi, number_of_overs").eq("id", 1).single();
  return { playingXI: data?.playing_xi ?? 11, oversLimit: data?.number_of_overs ?? 16 };
}

function fmtOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

async function handleInningsCompletion(supabase: any, matchId: string, innings: any, state: any) {
  if (innings.innings_number === 1) {
    const { data: existing } = await supabase.from("innings").select("id").eq("match_id", matchId).eq("innings_number", 2).maybeSingle();
    if (!existing) {
      await supabase.from("innings").insert({
        match_id: matchId,
        innings_number: 2,
        batting_team_id: innings.bowling_team_id,
        bowling_team_id: innings.batting_team_id,
        target: state.totalRuns + 1,
        status: "In Progress",
      });
    }
    return;
  }

  // Innings 2 complete — finalise the match and sync the result into
  // `matches` so the public Standings/Points Table picks it up automatically.
  const { data: innings1 } = await supabase.from("innings").select("*").eq("match_id", matchId).eq("innings_number", 1).single();
  const { playingXI } = await getSettings(supabase);

  const team1Runs = innings1.total_runs, team1Wkts = innings1.total_wickets, team1Balls = innings1.legal_balls;
  const team2Runs = state.totalRuns, team2Wkts = state.totalWickets, team2Balls = state.legalBalls;

  let winnerId: string | null = null;
  let margin = "";
  let isTie = false;

  if (team2Runs > team1Runs) {
    winnerId = innings1.bowling_team_id;
    const wicketsInHand = Math.max(0, (playingXI - 1) - team2Wkts);
    margin = `${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
  } else if (team1Runs > team2Runs) {
    winnerId = innings1.batting_team_id;
    margin = `${team1Runs - team2Runs} run${team1Runs - team2Runs === 1 ? "" : "s"}`;
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
    margin: margin || null,
    batting_first_id: innings1.batting_team_id,
  }).eq("id", matchId);
}

async function recomputeAndPersist(supabase: any, inningsId: string, matchId: string) {
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  const { data: balls } = await supabase.from("balls").select("*").eq("innings_id", inningsId).order("sequence_no");
  const { playingXI, oversLimit } = await getSettings(supabase);

  const state = computeInningsState(
    (balls ?? []) as BallRow[],
    { striker: innings.opening_striker_id, nonStriker: innings.opening_non_striker_id, bowler: innings.opening_bowler_id },
    playingXI, oversLimit
  );

  const targetReachedEarly = innings.innings_number === 2 && innings.target && state.totalRuns >= innings.target;
  const isComplete = state.isInningsComplete || targetReachedEarly;

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

export async function startInnings(payload: {
  matchId: string; inningsNumber: number; battingTeamId: string; bowlingTeamId: string;
  strikerId: string; nonStrikerId: string; bowlerId: string;
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  let target: number | null = null;
  if (payload.inningsNumber === 2) {
    const { data: inn1 } = await supabase.from("innings").select("total_runs").eq("match_id", payload.matchId).eq("innings_number", 1).single();
    target = (inn1?.total_runs ?? 0) + 1;
  }

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
    target,
  }).select().single();
  if (error) return { error: error.message };

  await supabase.from("matches").update({ status: "Live" }).eq("id", payload.matchId);
  await logAudit({ action: "Innings Started", entity: "Match", entityId: payload.matchId, field: "innings", newValue: payload.inningsNumber });

  revalidatePath(`/admin/scoring/${payload.matchId}`);
  revalidatePath(`/matches/${payload.matchId}`);
  return { ok: true, innings: data };
}

export async function recordBall(inningsId: string, matchId: string, payload: {
  runsOffBat: number; extraType: string | null; extraRuns: number;
  isWicket: boolean; wicketType: string | null; dismissedPlayerId: string | null;
  fielderId: string | null; newBatsmanId: string | null;
}): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  if (payload.isWicket && payload.wicketType) {
    const allowed = allowedWicketTypes(payload.extraType as any);
    if (!allowed.includes(payload.wicketType)) {
      return { error: `${payload.wicketType} is not a valid dismissal for this type of delivery.` };
    }
  }

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("*").eq("id", inningsId).single();
  if (!innings) return { error: "Innings not found." };
  if (innings.status === "Completed") return { error: "This innings has already ended." };

  const { count } = await supabase.from("balls").select("*", { count: "exact", head: true }).eq("innings_id", inningsId);
  const overNumber = Math.floor(innings.legal_balls / 6);
  const ballInOver = (innings.legal_balls % 6) + 1;

  const { error } = await supabase.from("balls").insert({
    innings_id: inningsId,
    sequence_no: (count ?? 0) + 1,
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
    dismissed_player_id: payload.dismissedPlayerId,
    fielder_id: payload.fielderId,
    new_batsman_id: payload.newBatsmanId,
    is_free_hit: innings.is_free_hit,
  });
  if (error) return { error: error.message };

  await recomputeAndPersist(supabase, inningsId, matchId);

  revalidatePath(`/admin/scoring/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/standings");
  return { ok: true };
}

export async function undoLastBall(inningsId: string, matchId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: lastBall } = await supabase.from("balls").select("id").eq("innings_id", inningsId).order("sequence_no", { ascending: false }).limit(1).maybeSingle();
  if (!lastBall) return { error: "No balls to undo." };

  await supabase.from("balls").delete().eq("id", lastBall.id);
  await supabase.from("innings").update({ status: "In Progress" }).eq("id", inningsId);
  const state = await recomputeAndPersist(supabase, inningsId, matchId);

  if (!state.isInningsComplete) {
    const { data: thisInnings } = await supabase.from("innings").select("innings_number").eq("id", inningsId).single();
    if (thisInnings?.innings_number === 1) {
      const { data: inn2 } = await supabase.from("innings").select("id").eq("match_id", matchId).eq("innings_number", 2).maybeSingle();
      if (inn2) {
        const { count } = await supabase.from("balls").select("*", { count: "exact", head: true }).eq("innings_id", inn2.id);
        if (!count) await supabase.from("innings").delete().eq("id", inn2.id);
      }
    }
    await supabase.from("matches").update({ status: "Live", winner_id: null, is_tie: false, margin: null }).eq("id", matchId);
  }

  revalidatePath(`/admin/scoring/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/standings");
  return { ok: true };
}

export async function setNewBowler(inningsId: string, matchId: string, bowlerId: string): Promise<any> {
  const g: any = await guard();
  if (g.error) return g;

  const supabase = createClient();
  const { data: innings } = await supabase.from("innings").select("last_over_bowler_id, legal_balls").eq("id", inningsId).single();
  if (innings?.last_over_bowler_id === bowlerId && innings.legal_balls > 0) {
    return { error: "The same bowler cannot bowl consecutive overs." };
  }
  await supabase.from("innings").update({ current_bowler_id: bowlerId }).eq("id", inningsId);
  revalidatePath(`/admin/scoring/${matchId}`);
  return { ok: true };
}
