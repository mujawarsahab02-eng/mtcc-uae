"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { AUCTION_ROLES, OVERRIDE_ROLES } from "@/lib/constants";
import { validateSale, computeSquad, computeRemainingPoints, type PlayerRow, type TeamRow } from "@/lib/auction";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Squad cap for one team: the tournament-wide limit, unless that team has its
// own limit set (teams.max_squad_override).
function teamMax(team: any, settings: any): number {
  const own = Number(team?.max_squad_override || 0);
  return own > 0 ? own : Number(settings?.max_squad_size || 0);
}
function isAuctionBuy(p: any, teamId: string) {
  return p.team_id === teamId && p.application_status === "Sold / Selected" && (p.team_role ?? "Auction Player") === "Auction Player";
}
// The 12 / 13 limit is for players bought in the auction. The squad check in
// validateSale also counts the Icon, so the Icon's place is added on top here.
function settingsFor(team: any, settings: any, players: any[]) {
  const bought = (players || []).filter((p: any) => isAuctionBuy(p, team?.id)).length;
  const extra = Math.max(0, computeSquad(team, players).length - bought);
  return { ...(settings || {}), max_squad_size: teamMax(team, settings) + extra };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function requireAuctionRole(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !AUCTION_ROLES.includes(profile.role)) {
    return { error: "Your role cannot run the live auction." } as const;
  }
  return { profile } as const;
}

async function loadContext(supabase: ReturnType<typeof createClient>) {
  const [{ data: auction }, { data: players }, { data: teams }, { data: settings }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("id", 1).single(),
    supabase.from("players").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
  ]);
  return { auction, players: players ?? [], teams: teams ?? [], settings };
}

// Only used for slow, non-live pages. Never called while bidding, because
// revalidating a route makes every open screen re-fetch and was the main
// cause of the lag between the Control Room and Display Mode.
function revalidateSlowPaths() {
  revalidatePath("/admin/players");
  revalidatePath("/admin/squads");
  revalidatePath("/admin");
  revalidatePath("/squads");
  revalidatePath("/team");
}

// Every team's purse and squad, worked out here on the server and saved
// into auction_state alongside the sale itself. The Display screen then
// reads the numbers out of the same row it already reads the bid from, so
// the purse can never lag behind a sale and needs no extra queries. Uses
// the very same helpers as the Control Room, so both screens always agree.
function buildTeamStats(teams: any[], players: any[], settings: any) {
  return (teams || []).map((t: any) => {
    const maxSquad = teamMax(t, settings);
    const bought = (players || []).filter((p: any) => isAuctionBuy(p, t.id)).length;
    const remaining = computeRemainingPoints(t, players);
    const total = Number(t.auction_points || 0);
    return {
      id: t.id, name: t.name, logo_path: t.logo_path ?? null,
      total, spent: total - remaining, remaining,
      bought, squad: bought, max: maxSquad || null,
      slots: maxSquad ? Math.max(0, maxSquad - bought) : null,
    };
  });
}

// Counters for the footer strip, saved in the same write.
function buildRoundStats(auction: any, players: any[]) {
  const order: string[] = auction?.pool_order || [];
  const byId: Record<string, any> = {};
  for (const p of players || []) byId[p.id] = p;
  const inPool = order.map((id) => byId[id]).filter(Boolean);
  return {
    sold: inPool.filter((p: any) => p.application_status === "Sold / Selected").length,
    unsold: inPool.filter((p: any) => p.application_status === "Unsold / Not Selected").length,
    queue: (players || []).filter((p: any) => p.application_status === "Unsold / Not Selected").length,
  };
}

// Recalculates and saves the team table on its own. Used when a screen
// opens before any sale has happened.
export async function refreshTeamStats(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players, teams, settings } = await loadContext(supabase);
  await supabase.from("auction_state").update({
    team_stats: buildTeamStats(teams, players, settings),
    round_stats: buildRoundStats(auction, players),
  }).eq("id", 1);
  return { ok: true };
}

const STALE = "Another bid landed first — the screen has been refreshed. Tap again if you still want this bid.";

// Compare-and-set: the bid only saves if the bid on the server is still what
// this screen showed, so two fast taps can never both land on one amount.
function onlyIfBidIs(query: any, bid: any) {
  return bid === null || bid === undefined ? query.is("current_bid", null) : query.eq("current_bid", bid);
}

export async function startAuction(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players, teams, settings } = await loadContext(supabase);
  if (!auction) return { error: "Auction state not initialised." };

  if (auction.status === "idle" || (auction.pool_order?.length ?? 0) === 0) {
    const eligible = players.filter(
      (p: any) => p.application_status === "Approved for Auction" && (p.team_role ?? "Auction Player") === "Auction Player"
    );
    const order = shuffle(eligible).map((p: any) => p.id);
    if (!order.length) return { error: "No players are Approved for Auction yet." };

    await supabase.from("players").update({ application_status: "Auction Pool" }).in("id", order);
    const seeded = players.map((p: any) => order.includes(p.id) ? { ...p, application_status: "Auction Pool" } : p);
    await supabase.from("auction_state").update({
      status: "live", round: "Main", pool_order: order, pool_index: 0, current_player_id: order[0],
      current_bid: 0, current_team_id: null, bid_history: [],
      team_stats: buildTeamStats(teams, seeded, settings),
      round_stats: buildRoundStats({ pool_order: order }, seeded),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    await logAudit({ action: "Auction Started", entity: "Auction", entityId: "auction", newValue: `${order.length} players` });
  } else {
    await supabase.from("auction_state").update({ status: "live", updated_at: new Date().toISOString() }).eq("id", 1);
  }
  revalidateSlowPaths();
  return { ok: true };
}

export async function pauseAuction(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("status").eq("id", 1).single();
  await supabase.from("auction_state").update({
    status: auction?.status === "paused" ? "live" : "paused", updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return { ok: true };
}

// The hot path. No revalidatePath at all: every screen picks the new bid up
// from the live feed, so this returns in well under a second.
export async function placeBid(teamId: string, nextAmount: number, override: boolean, expectedBid?: number): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const { profile } = guard;
  const supabase = createClient();

  const [{ data: auction }, { data: players }, { data: team }, { data: settings }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("id", 1).single(),
    supabase.from("players").select("*"),
    supabase.from("teams").select("*").eq("id", teamId).single(),
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
  ]);
  if (!auction?.current_player_id) return { error: "No player is on the block." };
  if (auction.status !== "live") return { error: "The auction is paused. Resume it before bidding." };

  const currentBid = Number(auction.current_bid || 0);
  if (typeof expectedBid === "number" && currentBid !== expectedBid) return { error: STALE, stale: true };
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) return { error: "Enter a valid bid amount." };
  if (nextAmount <= currentBid) return { error: `The bid must be higher than the current ${currentBid} pts.` };

  const player = (players ?? []).find((p: any) => p.id === auction.current_player_id) as PlayerRow | undefined;
  if (!player || !team) return { error: "Player or team not found." };

  const effectiveOverride = override && OVERRIDE_ROLES.includes(profile.role);
  const warnings = validateSale(team as TeamRow, player, nextAmount, (players ?? []) as PlayerRow[], settings as any);
  if (warnings.length && !effectiveOverride) return { error: warnings.join(" "), warnings };

  const bidHistory = [...(auction.bid_history || []), { teamId, teamName: (team as any).name, amount: nextAmount, ts: Date.now() }];
  const { data: saved } = await onlyIfBidIs(
    supabase.from("auction_state").update({
      current_bid: nextAmount, current_team_id: teamId, bid_history: bidHistory, updated_at: new Date().toISOString(),
    }).eq("id", 1),
    auction.current_bid
  ).select("id");
  if (!saved?.length) return { error: STALE, stale: true };

  await logAudit({ action: "Bid Placed", entity: "Player", entityId: player.id, field: "bid", previousValue: auction.current_bid, newValue: nextAmount });
  if (warnings.length && effectiveOverride) {
    await logAudit({ action: "Auction Override Used", entity: "Player", entityId: player.id, field: "bid", previousValue: "blocked", newValue: "overridden" });
  }
  return { ok: true };
}

// Steps the current player's bidding back one bid. Separate from undoing a
// SOLD/UNSOLD result.
export async function undoLastBid(expectedBid?: number): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("*").eq("id", 1).single();
  if (!auction?.current_player_id) return { error: "No player is on the block." };
  const history: any[] = auction.bid_history || [];
  if (!history.length) return { error: "There is no bid to undo." };
  if (typeof expectedBid === "number" && Number(auction.current_bid || 0) !== expectedBid) return { error: STALE, stale: true };

  const remaining = history.slice(0, -1);
  const prev = remaining[remaining.length - 1];
  const { data: saved } = await onlyIfBidIs(
    supabase.from("auction_state").update({
      current_bid: prev?.amount ?? 0, current_team_id: prev?.teamId ?? null, bid_history: remaining, updated_at: new Date().toISOString(),
    }).eq("id", 1),
    auction.current_bid
  ).select("id");
  if (!saved?.length) return { error: STALE, stale: true };

  const removed = history[history.length - 1];
  await logAudit({
    action: "Bid Undone", entity: "Player", entityId: auction.current_player_id, field: "bid",
    previousValue: `${removed.teamName} ${removed.amount}`, newValue: prev ? `${prev.teamName} ${prev.amount}` : "no bids",
  });
  return { ok: true };
}

// One single write: the result, the next player, and the recalculated team
// table all land together, so every screen sees a consistent picture in one
// live message rather than catching it halfway through.
async function advancePool(
  supabase: ReturnType<typeof createClient>, auction: any, actionLog: any[], lastAction: any,
  teams: any[], players: any[], settings: any
) {
  const nextIndex = Number(auction.pool_index || 0) + 1;
  const order: string[] = auction.pool_order || [];
  const done = nextIndex >= order.length;
  await supabase.from("auction_state").update({
    status: done ? "completed" : "live",
    pool_index: nextIndex,
    current_player_id: done ? null : order[nextIndex],
    current_bid: 0, current_team_id: null, bid_history: [],
    action_log: actionLog, last_action: lastAction,
    team_stats: buildTeamStats(teams, players, settings),
    round_stats: buildRoundStats(auction, players),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
}

export async function markSold(override: boolean): Promise<any> {
  const supabase = createClient();
  // Role check and data load run side by side: one wait instead of two.
  const [guard, { auction, players, teams, settings }] = await Promise.all([requireAuctionRole(), loadContext(supabase)]);
  if ("error" in guard) return guard;
  const { profile } = guard;
  if (!auction?.current_player_id || !auction.current_team_id) return { error: "No active bid to finalise." };

  const player = players.find((p: any) => p.id === auction.current_player_id) as PlayerRow | undefined;
  const team = teams.find((t: any) => t.id === auction.current_team_id) as TeamRow | undefined;
  if (!player || !team) return { error: "Player or team not found." };

  const effectiveOverride = override && OVERRIDE_ROLES.includes(profile.role);
  const warnings = validateSale(team, player, auction.current_bid, players as PlayerRow[], settingsFor(team, settings, players) as any);
  if (warnings.length && !effectiveOverride) return { error: warnings.join(" "), warnings };

  const prevStatus = (player as any).application_status;
  const actionLog = [...(auction.action_log || []), { playerId: (player as any).id, prevStatus, poolIndex: auction.pool_index }];
  const lastAction = {
    type: "SOLD", playerName: (player as any).full_name || "Player",
    teamName: (team as any).name || "", teamId: (team as any).id, amount: Number(auction.current_bid || 0), ts: Date.now(),
  };
  const afterSale = players.map((p: any) => p.id === (player as any).id
    ? { ...p, application_status: "Sold / Selected", team_id: (team as any).id, sold_points: auction.current_bid }
    : p);

  // All writes go out together (one wait). If the player row fails to save,
  // the auction row is put straight back the way it was.
  const [sell] = await Promise.all([
    supabase.from("players").update({
      application_status: "Sold / Selected", team_id: (team as any).id, sold_points: auction.current_bid,
    }).eq("id", (player as any).id),
    advancePool(supabase, auction, actionLog, lastAction, teams, afterSale, settings),
    logAudit({ action: "Player Sold", entity: "Player", entityId: (player as any).id, field: "application_status", previousValue: prevStatus, newValue: "Sold / Selected" }),
    warnings.length && effectiveOverride
      ? logAudit({ action: "Auction Override Used", entity: "Player", entityId: (player as any).id, field: "sale", previousValue: "blocked", newValue: "overridden" })
      : Promise.resolve(),
  ]);
  if (sell.error) {
    await supabase.from("auction_state").update({
      status: auction.status, pool_index: auction.pool_index, current_player_id: auction.current_player_id,
      current_bid: auction.current_bid, current_team_id: auction.current_team_id, bid_history: auction.bid_history || [],
      action_log: auction.action_log || [], last_action: auction.last_action ?? null, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    return { error: sell.error.message };
  }
  revalidateSlowPaths();
  return { ok: true };
}

export async function markUnsold(): Promise<any> {
  const supabase = createClient();
  const [guard, { auction, players, teams, settings }] = await Promise.all([requireAuctionRole(), loadContext(supabase)]);
  if ("error" in guard) return guard;
  if (!auction?.current_player_id) return { error: "No player is on the block." };
  const player = players.find((p: any) => p.id === auction.current_player_id);
  if (!player) return { error: "Player not found." };

  const prevStatus = player.application_status;
  const actionLog = [...(auction.action_log || []), { playerId: player.id, prevStatus, poolIndex: auction.pool_index }];
  const lastAction = { type: "UNSOLD", playerName: player.full_name || "Player", teamName: null, teamId: null, amount: 0, ts: Date.now() };
  const after = players.map((p: any) => p.id === player.id ? { ...p, application_status: "Unsold / Not Selected" } : p);

  const [res] = await Promise.all([
    supabase.from("players").update({ application_status: "Unsold / Not Selected" }).eq("id", player.id),
    advancePool(supabase, auction, actionLog, lastAction, teams, after, settings),
    logAudit({ action: "Player Unsold", entity: "Player", entityId: player.id, field: "application_status", previousValue: prevStatus, newValue: "Unsold / Not Selected" }),
  ]);
  if (res.error) return { error: res.error.message };
  revalidateSlowPaths();
  return { ok: true };
}

// Moves the current player to the end of the remaining pool, unchanged.
export async function deferPlayer(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("*").eq("id", 1).single();
  if (!auction?.pool_order?.length) return { error: "No pool." };

  const order = [...auction.pool_order];
  const [id] = order.splice(auction.pool_index, 1);
  order.push(id);
  await supabase.from("auction_state").update({
    pool_order: order, current_player_id: order[auction.pool_index],
    current_bid: 0, current_team_id: null, bid_history: [], updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return { ok: true };
}

// Reverses the last SOLD/UNSOLD: the team gets its points back and the
// player returns to the block for fresh bidding.
export async function undoLastPlayerResult(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players, teams, settings } = await loadContext(supabase);
  const log = auction?.action_log || [];
  if (!log.length) return { error: "There is no result to undo." };

  const last = log[log.length - 1];
  const { error } = await supabase.from("players")
    .update({ application_status: last.prevStatus, team_id: null, sold_points: null })
    .eq("id", last.playerId);
  if (error) return { error: error.message };

  const reverted = players.map((p: any) => p.id === last.playerId
    ? { ...p, application_status: last.prevStatus, team_id: null, sold_points: null } : p);
  const nextAuction = { ...auction, pool_index: last.poolIndex };
  await supabase.from("auction_state").update({
    status: "live", pool_index: last.poolIndex, current_player_id: auction.pool_order[last.poolIndex],
    action_log: log.slice(0, -1), current_bid: 0, current_team_id: null, bid_history: [], last_action: null,
    team_stats: buildTeamStats(teams, reverted, settings),
    round_stats: buildRoundStats(nextAuction, reverted),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  await logAudit({ action: "Undo Last Player Result", entity: "Player", entityId: last.playerId, field: "application_status", previousValue: "—", newValue: last.prevStatus });
  revalidateSlowPaths();
  return { ok: true };
}

// Clears the live bidding state only. Players already Sold or Unsold keep
// their results. Super Admin only.
export async function resetAuction(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !OVERRIDE_ROLES.includes(profile.role)) return { error: "Only Super Admin can reset the auction." };
  const supabase = createClient();
  const { players, teams, settings } = await loadContext(supabase);
  await supabase.from("auction_state").update({
    status: "idle", round: "Main", pool_order: [], pool_index: 0, current_player_id: null,
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    team_stats: buildTeamStats(teams, players, settings), round_stats: { sold: 0, unsold: 0, queue: 0 },
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  await logAudit({ action: "Auction Reset", entity: "Auction", entityId: "auction" });
  revalidateSlowPaths();
  return { ok: true };
}

// For test runs: everything Reset does, PLUS every auctioned player goes
// back to the list and every purse is restored. Owners and Captain/Icons are
// never touched. Super Admin only.
export async function fullResetAuction(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !OVERRIDE_ROLES.includes(profile.role)) return { error: "Only Super Admin can do a full reset." };
  const supabase = createClient();

  const { data: reverted, error } = await supabase.from("players")
    .update({ application_status: "Approved for Auction", team_id: null, sold_points: null })
    .in("application_status", ["Sold / Selected", "Unsold / Not Selected", "Auction Pool"])
    .or('team_role.is.null,team_role.eq."Auction Player"')
    .select("id");
  if (error) return { error: error.message };

  const { players: after, teams, settings } = await loadContext(supabase);
  await supabase.from("auction_state").update({
    status: "idle", round: "Main", pool_order: [], pool_index: 0, current_player_id: null,
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    team_stats: buildTeamStats(teams, after, settings), round_stats: { sold: 0, unsold: 0, queue: 0 },
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  await logAudit({ action: "Auction Full Reset", entity: "Auction", entityId: "auction", newValue: `${reverted?.length ?? 0} players returned` });
  revalidateSlowPaths();
  return { ok: true, count: reverted?.length ?? 0 };
}

// Runs the Unsold Queue as a fresh round. Anyone unsold again returns to the
// queue, so more rounds can be run.
export async function startUnsoldRound(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: unsoldPlayers } = await supabase.from("players").select("id").eq("application_status", "Unsold / Not Selected");
  if (!unsoldPlayers?.length) return { error: "The Unsold Queue is empty." };

  const ids = shuffle(unsoldPlayers.map((p: any) => p.id));
  await supabase.from("players").update({ application_status: "Auction Pool" }).in("id", ids);
  const { players, teams, settings } = await loadContext(supabase);
  await supabase.from("auction_state").update({
    status: "live", round: "Unsold", pool_order: ids, pool_index: 0, current_player_id: ids[0],
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    team_stats: buildTeamStats(teams, players, settings),
    round_stats: buildRoundStats({ pool_order: ids }, players),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  await logAudit({ action: "Unsold Round Started", entity: "Auction", entityId: "auction", newValue: `${ids.length} players` });
  revalidateSlowPaths();
  return { ok: true };
}
