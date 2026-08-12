"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { AUCTION_ROLES, OVERRIDE_ROLES } from "@/lib/constants";
import { validateSale, type PlayerRow, type TeamRow } from "@/lib/auction";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function requireAuctionRole() {
  const profile = await getCurrentProfile();
  if (!profile || !AUCTION_ROLES.includes(profile.role)) {
    return { error: "Your role cannot run the live auction." } as const;
  }
  return { profile } as const;
}

async function loadContext(supabase: ReturnType<typeof createClient>) {
  const [{ data: auction }, { data: players }, { data: teams }, { data: settings }, { data: categories }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("id", 1).single(),
    supabase.from("players").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
    supabase.from("auction_categories").select("name").order("sort_order"),
  ]);
  return { auction, players: players ?? [], teams: teams ?? [], settings, categories: (categories ?? []).map((c) => c.name) };
}

function revalidateAuctionPaths() {
  revalidatePath("/admin/auction");
  revalidatePath("/admin/players");
  revalidatePath("/admin/squads");
  revalidatePath("/admin");
  revalidatePath("/auction/display");
  revalidatePath("/team");
}

export async function startAuction() {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players, categories } = await loadContext(supabase);
  if (!auction) return { error: "Auction state not initialised." };

  if (auction.status === "idle" || (auction.pool_order?.length ?? 0) === 0) {
    const eligible = players.filter((p: any) => p.application_status === "Approved for Auction");
    const catOrder = categories.length ? categories : ["Unassigned"];
    const sorted = [...eligible].sort((a: any, b: any) => {
      const ia = catOrder.indexOf(a.auction_category) === -1 ? 999 : catOrder.indexOf(a.auction_category);
      const ib = catOrder.indexOf(b.auction_category) === -1 ? 999 : catOrder.indexOf(b.auction_category);
      if (ia !== ib) return ia - ib;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const order = sorted.map((p: any) => p.id);

    if (order.length) {
      await supabase.from("players").update({ application_status: "Auction Pool" }).in("id", order);
    }
    await supabase.from("auction_state").update({
      status: "live", pool_order: order, pool_index: 0, current_player_id: order[0] ?? null,
      current_bid: 0, current_team_id: null, bid_history: [], updated_at: new Date().toISOString(),
    }).eq("id", 1);
    await logAudit({ action: "Auction Started", entity: "Auction", entityId: "auction" });
  } else {
    await supabase.from("auction_state").update({ status: "live", updated_at: new Date().toISOString() }).eq("id", 1);
  }
  revalidateAuctionPaths();
  return { ok: true };
}

export async function pauseAuction() {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { data: auction } = await supabase.from("auction_state").select("status").eq("id", 1).single();
  await supabase.from("auction_state").update({ status: auction?.status === "paused" ? "live" : "paused" }).eq("id", 1);
  revalidateAuctionPaths();
  return { ok: true };
}

export async function placeBid(teamId: string, nextAmount: number, override: boolean) {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const { profile } = guard;
  const supabase = createClient();
  const { auction, players, teams, settings } = await loadContext(supabase);
  if (!auction?.current_player_id) return { error: "No active player." };

  const player = players.find((p: any) => p.id === auction.current_player_id) as PlayerRow | undefined;
  const team = teams.find((t: any) => t.id === teamId) as TeamRow | undefined;
  if (!player || !team) return { error: "Player or team not found." };

  const effectiveOverride = override && OVERRIDE_ROLES.includes(profile.role);
  const warnings = validateSale(team, player, nextAmount, players as PlayerRow[], settings as any);
  if (warnings.length && !effectiveOverride) return { error: warnings.join(" "), warnings };

  const bidHistory = [...(auction.bid_history || []), { teamId, teamName: (team as any).name, amount: nextAmount, ts: Date.now() }];
  await supabase.from("auction_state").update({
    current_bid: nextAmount, current_team_id: teamId, bid_history: bidHistory, updated_at: new Date().toISOString(),
  }).eq("id", 1);

  await logAudit({ action: "Bid Placed", entity: "Player", entityId: player.id, field: "bid", previousValue: auction.current_bid, newValue: nextAmount });
  if (warnings.length && effectiveOverride) {
    await logAudit({ action: "Auction Override Used", entity: "Player", entityId: player.id, field: "bid", previousValue: "blocked", newValue: "overridden" });
  }
  revalidateAuctionPaths();
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
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
}

export async function markSold(override: boolean) {
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

export async function markUnsold() {
  const guard = await requireAuctionRole();
  if ("error" in guard) return guard;
  const supabase = createClient();
  const { auction, players } = await loadContext(supabase);
  if (!auction?.current_player_id) return { error: "No active player." };
  const player = players.find((p: any) => p.id === auction.current_player_id);
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

// Item 11 & 12: DEFER PLAYER moves the current player to the end of the
// remaining pool without changing their status — never lost.
export async function deferPlayer() {
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
  }).eq("id", 1);
  revalidateAuctionPaths();
  return { ok: true };
}

// Item 13: reverses the last SOLD/UNSOLD result only — not individual bids.
export async function undoLastPlayerResult() {
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
  }).eq("id", 1);

  await logAudit({ action: "Undo Last Player Result", entity: "Player", entityId: last.playerId, field: "application_status", previousValue: "—", newValue: last.prevStatus });
  revalidateAuctionPaths();
  return { ok: true };
}
