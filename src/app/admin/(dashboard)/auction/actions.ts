"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { AUCTION_ROLES, OVERRIDE_ROLES } from "@/lib/constants";
import { validateSale, type PlayerRow, type TeamRow } from "@/lib/auction";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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

function revalidateAuctionPaths() {
  revalidatePath("/admin/auction");
  revalidatePath("/admin/players");
  revalidatePath("/admin/squads");
  revalidatePath("/admin");
  revalidatePath("/auction/display");
  revalidatePath("/team");
  revalidatePath("/squads");
}

const STALE = "Another bid came in first. The screen has been refreshed, tap again if needed.";

// Saves the new bid only if the bid on the server hasn't changed since it
// was read, so two quick taps can never both land on the same amount.
function onlyIfBidIs(query: any, bid: any) {
  return bid === null || bid === undefined ? query.is("current_bid", null) : query.eq("current_bid", bid);
}

export async function startAuction(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players } = await loadContext(supabase);
  if (!auction) return { error: "Auction state not initialised." };

  if (auction.status === "idle" || (auction.pool_order?.length ?? 0) === 0) {
    const eligible = players.filter((p: any) => p.application_status === "Approved for Auction" && (p.team_role ?? "Auction Player") === "Auction Player");
    const order = shuffle(eligible).map((p: any) => p.id);

    if (order.length) {
      await supabase.from("players").update({ application_status: "Auction Pool" }).in("id", order);
    }
    await supabase.from("auction_state").update({
      status: "live", round: "Main", pool_order: order, pool_index: 0, current_player_id: order[0] ?? null,
      current_bid: 0, current_team_id: null, bid_history: [], call_status: null, timer_ends_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    await logAudit({ action: "Auction Started", entity: "Auction", entityId: "auction" });
  } else {
    await supabase.from("auction_state").update({ status: "live", updated_at: new Date().toISOString() }).eq("id", 1);
  }
  revalidateAuctionPaths();
  return { ok: true };
}

export async function pauseAuction(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("status").eq("id", 1).single();
  await supabase.from("auction_state").update({ status: auction?.status === "paused" ? "live" : "paused", updated_at: new Date().toISOString() }).eq("id", 1);
  return { ok: true };
}

// Fast path: bids don't re-render any page. Every screen (Control Room,
// Display Mode, team dashboards) picks the change up from the live feed.
// expectedBid guards against two bids landing on the same amount: the save
// only succeeds if the bid on the server is still what this screen showed.
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
  if (!auction?.current_player_id) return { error: "No active player." };
  const currentBid = Number(auction.current_bid || 0);
  if (typeof expectedBid === "number" && currentBid !== expectedBid) return { error: STALE, stale: true };

  const player = (players ?? []).find((p: any) => p.id === auction.current_player_id) as PlayerRow | undefined;
  if (!player || !team) return { error: "Player or team not found." };

  const effectiveOverride = override && OVERRIDE_ROLES.includes(profile.role);
  const warnings = validateSale(team as TeamRow, player, nextAmount, (players ?? []) as PlayerRow[], settings as any);
  if (warnings.length && !effectiveOverride) return { error: warnings.join(" "), warnings };

  const bidHistory = [...(auction.bid_history || []), { teamId, teamName: (team as any).name, amount: nextAmount, ts: Date.now() }];
  const { data: saved } = await onlyIfBidIs(supabase.from("auction_state").update({
    current_bid: nextAmount, current_team_id: teamId, bid_history: bidHistory,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1), auction.current_bid).select("id");
  if (!saved?.length) return { error: STALE, stale: true };

  await Promise.all([
    logAudit({ action: "Bid Placed", entity: "Player", entityId: player.id, field: "bid", previousValue: auction.current_bid, newValue: nextAmount }),
    warnings.length && effectiveOverride
      ? logAudit({ action: "Auction Override Used", entity: "Player", entityId: player.id, field: "bid", previousValue: "blocked", newValue: "overridden" })
      : Promise.resolve(),
  ]);
  return { ok: true };
}

// Steps the current player's bidding back by one bid (previous amount and
// team). Separate from undoing a SOLD/UNSOLD result.
export async function undoLastBid(expectedBid?: number): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("*").eq("id", 1).single();
  if (!auction?.current_player_id) return { error: "No active player." };
  const history: any[] = auction.bid_history || [];
  if (!history.length) return { error: "There is no bid to undo." };
  if (typeof expectedBid === "number" && Number(auction.current_bid || 0) !== expectedBid) return { error: STALE, stale: true };

  const remaining = history.slice(0, -1);
  const prev = remaining[remaining.length - 1];
  const { data: saved } = await onlyIfBidIs(supabase.from("auction_state").update({
    current_bid: prev?.amount ?? 0, current_team_id: prev?.teamId ?? null, bid_history: remaining,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1), auction.current_bid).select("id");
  if (!saved?.length) return { error: STALE, stale: true };

  const removed = history[history.length - 1];
  await logAudit({ action: "Bid Undone", entity: "Player", entityId: auction.current_player_id, field: "bid", previousValue: `${removed.teamName} ${removed.amount}`, newValue: prev ? `${prev.teamName} ${prev.amount}` : "no bids" });
  return { ok: true };
}

async function advancePool(supabase: ReturnType<typeof createClient>, auction: any, nextStatusIfLastElseLive: "completed" | "live") {
  const nextIndex = auction.pool_index + 1;
  const done = nextIndex >= (auction.pool_order?.length ?? 0);
  await supabase.from("auction_state").update({
    status: done ? "completed" : nextStatusIfLastElseLive,
    pool_index: nextIndex,
    current_player_id: done ? null : auction.pool_order[nextIndex],
    current_bid: 0, current_team_id: null, bid_history: [],
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
}

export async function markSold(override: boolean): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const { profile } = guard;
  const supabase = createClient();
  const { auction, players, teams, settings } = await loadContext(supabase);
  if (!auction?.current_player_id || !auction.current_team_id) return { error: "No active bid to finalise." };

  const player = players.find((p: any) => p.id === auction.current_player_id) as PlayerRow | undefined;
  const team = teams.find((t: any) => t.id === auction.current_team_id) as TeamRow | undefined;
  if (!player || !team) return { error: "Player or team not found." };

  const effectiveOverride = override && OVERRIDE_ROLES.includes(profile.role);
  const warnings = validateSale(team, player, auction.current_bid, players as PlayerRow[], settings as any);
  if (warnings.length && !effectiveOverride) return { error: warnings.join(" "), warnings };

  const prevStatus = player.application_status;
  await supabase.from("players").update({
    application_status: "Sold / Selected", team_id: team.id, sold_points: auction.current_bid,
  }).eq("id", player.id);

  const actionLog = [...(auction.action_log || []), { playerId: player.id, prevStatus, poolIndex: auction.pool_index }];
  await supabase.from("auction_state").update({
    action_log: actionLog,
    last_action: { type: "SOLD", playerName: (player as any).full_name, teamName: (team as any).name, amount: auction.current_bid, ts: Date.now() },
  }).eq("id", 1);

  await advancePool(supabase, { ...auction, action_log: actionLog }, "live");
  await logAudit({ action: "Player Sold", entity: "Player", entityId: player.id, field: "application_status", previousValue: prevStatus, newValue: "Sold / Selected" });
  if (warnings.length && effectiveOverride) {
    await logAudit({ action: "Auction Override Used", entity: "Player", entityId: player.id, field: "sale", previousValue: "blocked", newValue: "overridden" });
  }
  revalidateAuctionPaths();
  return { ok: true };
}

// Unsold players go to the Unsold Queue ("Unsold / Not Selected") and get
// another chance in the Unsold Round once the main list is finished.
export async function markUnsold(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("*").eq("id", 1).single();
  if (!auction?.current_player_id) return { error: "No active player." };
  const { data: player } = await supabase.from("players").select("id, full_name, application_status").eq("id", auction.current_player_id).single();
  if (!player) return { error: "Player not found." };

  const prevStatus = player.application_status;
  await supabase.from("players").update({ application_status: "Unsold / Not Selected" }).eq("id", player.id);

  const actionLog = [...(auction.action_log || []), { playerId: player.id, prevStatus, poolIndex: auction.pool_index }];
  await supabase.from("auction_state").update({
    action_log: actionLog,
    last_action: { type: "UNSOLD", playerName: player.full_name, teamName: null, amount: 0, ts: Date.now() },
  }).eq("id", 1);

  await advancePool(supabase, { ...auction, action_log: actionLog }, "live");
  await logAudit({ action: "Player Unsold", entity: "Player", entityId: player.id, field: "application_status", previousValue: prevStatus, newValue: "Unsold / Not Selected" });
  revalidateAuctionPaths();
  return { ok: true };
}

// DEFER PLAYER moves the current player to the end of the remaining pool
// without changing their status — never lost.
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
    pool_order: order, current_player_id: order[auction.pool_index], current_bid: 0, current_team_id: null, bid_history: [],
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return { ok: true };
}

// Reverses the last SOLD/UNSOLD result.
export async function undoLastPlayerResult(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("*").eq("id", 1).single();
  const log = auction?.action_log || [];
  if (!log.length) return { error: "Nothing to undo." };

  const last = log[log.length - 1];
  await supabase.from("players").update({ application_status: last.prevStatus, team_id: null, sold_points: null }).eq("id", last.playerId);
  await supabase.from("auction_state").update({
    status: "live", pool_index: last.poolIndex, current_player_id: auction.pool_order[last.poolIndex],
    action_log: log.slice(0, -1), current_bid: 0, current_team_id: null, bid_history: [], last_action: null,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  await logAudit({ action: "Undo Last Player Result", entity: "Player", entityId: last.playerId, field: "application_status", previousValue: "—", newValue: last.prevStatus });
  revalidateAuctionPaths();
  return { ok: true };
}

// Full reset back to idle. Does NOT touch players already marked Sold/Unsold.
// Super Admin only.
export async function resetAuction(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !OVERRIDE_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin can reset the auction." };
  }
  const supabase = createClient();
  await supabase.from("auction_state").update({
    status: "idle", round: "Main",
    pool_order: [], pool_index: 0, current_player_id: null,
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  await logAudit({ action: "Auction Reset", entity: "Auction", entityId: "auction" });
  revalidateAuctionPaths();
  return { ok: true };
}

// FULL RESET, for test runs: everything "Reset Auction" does, PLUS every
// auctioned player (Sold, Unsold or still in the pool) goes back to
// "Approved for Auction" with no team and no points, so every team purse is
// restored. Owners and Captain/Icon players are never touched — only
// players whose role is "Auction Player". Super Admin only.
export async function fullResetAuction(): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !OVERRIDE_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin can do a full reset." };
  }
  const supabase = createClient();

  const { data: reverted, error } = await supabase.from("players")
    .update({ application_status: "Approved for Auction", team_id: null, sold_points: null })
    .in("application_status", ["Sold / Selected", "Unsold / Not Selected", "Auction Pool"])
    .or('team_role.is.null,team_role.eq."Auction Player"')
    .select("id");
  if (error) return { error: error.message };

  await supabase.from("auction_state").update({
    status: "idle", round: "Main",
    pool_order: [], pool_index: 0, current_player_id: null,
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  await logAudit({ action: "Auction Full Reset", entity: "Auction", entityId: "auction", newValue: `${reverted?.length ?? 0} players returned to the auction list` });
  revalidateAuctionPaths();
  return { ok: true, count: reverted?.length ?? 0 };
}

// Runs the Unsold Queue: every "Unsold / Not Selected" player goes back into
// a fresh, shuffled pool. Anyone unsold again returns to the queue, so more
// rounds can be run. Sold players and team purses are untouched.
export async function startUnsoldRound(): Promise<any> {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("status, current_player_id").eq("id", 1).single();
  if (auction?.status === "live" && auction.current_player_id) {
    return { error: "Finish the main list first. The Unsold Round starts when no player is on the block." };
  }
  const { data: unsoldPlayers } = await supabase.from("players").select("id").eq("application_status", "Unsold / Not Selected");
  if (!unsoldPlayers?.length) return { error: "The Unsold Queue is empty." };

  const ids = shuffle(unsoldPlayers.map((p: any) => p.id));
  await supabase.from("players").update({ application_status: "Approved for Auction" }).in("id", ids);
  await supabase.from("auction_state").update({
    status: "live", round: "Unsold", pool_order: ids, pool_index: 0, current_player_id: ids[0],
    current_bid: 0, current_team_id: null, bid_history: [], action_log: [], last_action: null,
    call_status: null, timer_ends_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  await logAudit({ action: "Unsold Round Started", entity: "Auction", entityId: "auction", newValue: `${ids.length} players` });
  revalidateAuctionPaths();
  return { ok: true };
}

