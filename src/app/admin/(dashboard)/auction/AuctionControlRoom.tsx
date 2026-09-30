"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, SectionHeader, SeamDivider, StatCard } from "@/components/ui";
import { AUCTION_ROLES, OVERRIDE_ROLES, computeAge } from "@/lib/constants";
import { computeRemainingPoints, computeSquad, computeGuestCount, validateSale } from "@/lib/auction";
import {
  startAuction, pauseAuction, endAuction, markSold, markUnsold,
  deferPlayer, undoLastPlayerResult, resetAuction, fullResetAuction, startUnsoldRound, refreshTeamStats,
} from "./actions";

// Tiered bid step: the increment grows as the bid climbs.
function computeNextBid(currentBid: number, s: any) {
  const startingBid = s?.auction_starting_bid ?? 2000;
  if (!currentBid) return startingBid;
  if (currentBid >= (s?.auction_tier4_threshold ?? 20000)) return currentBid + (s?.auction_tier4_increment ?? 5000);
  if (currentBid >= (s?.auction_tier3_threshold ?? 15000)) return currentBid + (s?.auction_tier3_increment ?? 3000);
  if (currentBid >= (s?.auction_tier2_threshold ?? 10000)) return currentBid + (s?.auction_tier2_increment ?? 2000);
  return currentBid + (s?.auction_bid_increment ?? 1000);
}
const fmt = (n: any) => Number(n || 0).toLocaleString("en-US");
const STEP = 1000;

export default function AuctionControlRoom({ initialAuction, initialPlayers, initialTeams, settings, currentRole }: any) {
  const supabase = useMemo(() => createClient(), []);
  const [auction, setAuction] = useState<any>(initialAuction);
  const [players, setPlayers] = useState<any[]>(initialPlayers || []);
  const [teams, setTeams] = useState<any[]>(initialTeams || []);
  const [override, setOverride] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"sold" | "unsold" | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualTeam, setManualTeam] = useState("");

  // Instant bidding: a tap updates the screen at once and the save runs in
  // the background, one after another so none overtake each other.
  const auctionRef = useRef<any>(initialAuction);
  const queueRef = useRef<Promise<any>>(Promise.resolve());
  const pendingRef = useRef(0);

  function applyAuction(next: any) {
    if (!next) return;
    auctionRef.current = next;
    setAuction(next);
  }

  const canRun = AUCTION_ROLES.includes(currentRole);
  const canOverride = OVERRIDE_ROLES.includes(currentRole);
  const maxBid = settings?.auction_max_bid ?? 100000;
  const currentBid = Number(auction?.current_bid || 0);
  const nextBidAmount = computeNextBid(currentBid, settings);
  const bidMaxReached = nextBidAmount > maxBid;

  async function refreshAll() {
    const [{ data: a }, { data: p }, { data: t }] = await Promise.all([
      supabase.from("auction_state").select("*").eq("id", 1).single(),
      supabase.from("players").select("*"),
      supabase.from("teams").select("*"),
    ]);
    if (p) setPlayers(p);
    if (t) setTeams(t);
    if (a && pendingRef.current === 0) applyAuction(a);
  }

  useEffect(() => {
    const channel = supabase
      .channel("auction-control-room")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state", filter: "id=eq.1" }, (payload: any) => {
        if (pendingRef.current === 0) applyAuction(payload.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload: any) => {
        setPlayers((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== payload.old.id);
          return prev.some((p) => p.id === payload.new.id)
            ? prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            : [...prev, payload.new];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teams" }, (payload: any) => {
        setTeams((prev) => prev.map((t) => (t.id === payload.new.id ? payload.new : t)));
      })
      .subscribe();
    // Makes sure Display Mode has a team table to show before the first
    // sale of the day.
    refreshTeamStats().catch(() => {});
    // Safety net: even if the live feed drops, nothing is ever more than a
    // few seconds stale.
    const poll = setInterval(refreshAll, 4000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const currentPlayer = players.find((p: any) => p.id === auction?.current_player_id) || null;
  const leadingTeam = teams.find((t: any) => t.id === auction?.current_team_id) || null;

  const teamsWithStats = useMemo(() => teams.map((t: any) => ({
    ...t,
    remaining: computeRemainingPoints(t, players),
    squadCount: players.filter((p: any) => p.team_id === t.id && p.application_status === "Sold / Selected" && (p.team_role ?? "Auction Player") === "Auction Player").length,
    fullSquadCount: computeSquad(t, players).length,
    guestCount: computeGuestCount(t, players),
  })), [teams, players]);

  const unsoldPlayers = useMemo(() => players.filter((p: any) => p.application_status === "Unsold / Not Selected"), [players]);
  const isUnsoldRound = auction?.round === "Unsold";

  // The most recent SOLD/UNSOLD — the one Undo reverses.
  const lastResult = useMemo(() => {
    const log = auction?.action_log || [];
    const last = log[log.length - 1];
    if (!last) return null;
    const p = players.find((x: any) => x.id === last.playerId);
    if (!p) return null;
    const sold = p.application_status === "Sold / Selected";
    const team = sold ? teams.find((t: any) => t.id === p.team_id) : null;
    return { name: p.full_name || "Player", sold, teamName: team?.name || "", amount: Number(p.sold_points || 0) };
  }, [auction, players, teams]);

  const summary = useMemo(() => {
    const order: string[] = auction?.pool_order || [];
    const processed = order.map((id) => players.find((p: any) => p.id === id)).filter(Boolean) as any[];
    const sold = processed.filter((p) => p.application_status === "Sold / Selected");
    return {
      total: processed.length,
      sold: sold.length,
      unsold: processed.filter((p) => p.application_status === "Unsold / Not Selected").length,
      totalSpent: sold.reduce((s, p) => s + Number(p.sold_points || 0), 0),
    };
  }, [auction, players]);

  function enqueue(task: () => Promise<any>) {
    pendingRef.current += 1;
    setSaving(true);
    queueRef.current = queueRef.current
      .then(async () => {
        let res: any;
        try { res = await task(); } catch (e: any) { res = { error: e?.message || "Network problem — please try again." }; }
        if (res?.error) setMsg(res.error);
      })
      .finally(() => {
        pendingRef.current -= 1;
        // The final resync puts the true server state back on screen, so a
        // rejected bid can never leave a wrong number showing.
        if (pendingRef.current === 0) { setSaving(false); refreshAll(); }
      });
  }

  async function run(fn: () => Promise<any>) {
    setBusy(true); setMsg("");
    await queueRef.current;
    let res: any;
    try { res = await fn(); } catch (e: any) { res = { error: e?.message || "Network problem — please try again." }; }
    setBusy(false);
    if (res?.error) setMsg(res.error);
    refreshAll();
    return res;
  }

  function submitBid(teamId: string, amount: number) {
    const cur = auctionRef.current;
    const team = teams.find((t: any) => t.id === teamId);
    const player = players.find((p: any) => p.id === cur?.current_player_id);
    if (!team || !player || !cur) return;
    if (cur.status !== "live") { setMsg("The auction is paused. Resume it before bidding."); return; }

    const expected = Number(cur.current_bid || 0);
    if (amount <= expected) { setMsg(`The bid must be higher than the current ${fmt(expected)} pts.`); return; }
    if (amount > maxBid) { setMsg(`Maximum bid is ${fmt(maxBid)} pts.`); return; }
    const capBase = Number(team.max_squad_override || 0) || Number(settings?.max_squad_size || 0);
    const boughtNow = players.filter((p: any) => p.team_id === team.id && p.application_status === "Sold / Selected" && (p.team_role ?? "Auction Player") === "Auction Player").length;
    const warnings = validateSale(team, player, amount, players, { ...settings, max_squad_size: capBase + Math.max(0, computeSquad(team, players).length - boughtNow) });
    if (warnings.length && !(override && canOverride)) { setMsg(warnings.join(" ")); return; }

    setMsg("");
    applyAuction({
      ...cur, current_bid: amount, current_team_id: teamId,
      bid_history: [...(cur.bid_history || []), { teamId, teamName: team.name, amount, ts: Date.now() }],
    });
    enqueue(async () => { const { data, error } = await supabase.rpc("place_bid", { p_team_id: teamId, p_amount: amount, p_expected: expected }); return error ? { error: error.message } : data; });
  }

  function tapTeam(teamId: string) {
    const cur = auctionRef.current;
    if (cur?.current_team_id === teamId) {
      const t = teams.find((x: any) => x.id === teamId);
      setMsg(`${t?.name || "That team"} is already the highest bidder.`);
      return;
    }
    submitBid(teamId, computeNextBid(Number(cur?.current_bid || 0), settings));
  }

  function submitManualBid() {
    const amount = Number(manualAmount);
    if (!manualTeam) { setMsg("Choose the bidding team."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setMsg("Enter a bid amount."); return; }
    if (amount % STEP !== 0) { setMsg(`The amount must be a multiple of ${fmt(STEP)} (e.g. ${fmt(Math.round(amount / STEP) * STEP)}).`); return; }
    submitBid(manualTeam, amount);
    setManualAmount(""); setManualTeam("");
  }

  function tryUndoBid() {
    const cur = auctionRef.current;
    const history: any[] = cur?.bid_history || [];
    if (!history.length) return;
    const expected = Number(cur.current_bid || 0);
    const remaining = history.slice(0, -1);
    const prev = remaining[remaining.length - 1];
    setMsg("");
    applyAuction({ ...cur, current_bid: prev?.amount ?? 0, current_team_id: prev?.teamId ?? null, bid_history: remaining });
    enqueue(async () => { const { data, error } = await supabase.rpc("undo_last_bid", { p_expected: expected }); return error ? { error: error.message } : data; });
  }

  function flashResult(kind: "sold" | "unsold", fn: () => Promise<any>) {
    setFlash(kind);
    setTimeout(() => setFlash(null), 900);
    run(fn);
  }

  if (!canRun) {
    return (
      <div>
        <SectionHeader eyebrow="Live" title="Player Auction" />
        <SeamDivider />
        <Card className="p-4 mb-5 text-sm text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Your role ({currentRole}) has view-only access. Only Super Admin, Tournament Admin and Auction Admin can run bidding.
        </Card>
        <PurseGrid teams={teamsWithStats} settings={settings} />
      </div>
    );
  }

  return (
    <div
      className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16"
      style={{ background: "radial-gradient(ellipse 900px 500px at 50% 0%, #16213D 0%, #0A0F1C 55%, #05070d 100%)", minHeight: "100vh" }}
    >
      <SectionHeader
        eyebrow={isUnsoldRound ? "Live · Unsold Round" : "Live · Main List"}
        title="Player Auction — Control Room"
        action={
          <div className="flex gap-2 flex-wrap">
            <Link href="/auction/display" target="_blank"><Button variant="ghost" size="sm">Open Display Mode ↗</Button></Link>
            {auction?.status !== "live" && auction?.status !== "completed" ? (
              <Button variant="primary" size="sm" onClick={() => run(startAuction)} disabled={busy}>
                {auction?.pool_order?.length ? "Resume Auction" : "Start Auction"}
              </Button>
            ) : auction?.status === "live" ? (
              <Button variant="subtle" size="sm" onClick={() => run(pauseAuction)} disabled={busy}>Pause Auction</Button>
            ) : null}
            {auction?.status !== "completed" && auction?.status !== "idle" && (
              <Button variant="danger" size="sm" disabled={busy}
                onClick={() => {
                  if (window.confirm("END the auction? The Display screen will stop showing the auction and ask visitors to contact the organisers. Only do this when the auction is fully finished.")) run(endAuction);
                }}>
                End Auction
              </Button>
            )}
            {canOverride && (
              <Button variant="danger" size="sm" disabled={busy}
                onClick={() => {
                  if (window.confirm("Reset the auction back to idle? This clears the current bidding state and pool order, but does NOT undo players already marked Sold or Unsold.")) run(resetAuction);
                }}>
                Reset Auction
              </Button>
            )}
            {canOverride && (
              <Button variant="danger" size="sm" disabled={busy}
                onClick={async () => {
                  const typed = window.prompt("FULL RESET (for test runs)\n\nThis undoes EVERY auction result: all Sold and Unsold players go back to the list and every purse is restored. Owners and Captain/Icon players stay with their teams.\n\nType RESET to confirm.");
                  if (typed !== "RESET") return;
                  const res: any = await run(fullResetAuction);
                  if (res?.ok) window.alert(`Full reset done. ${res.count} player${res.count === 1 ? "" : "s"} returned to the auction list.`);
                }}>
                Full Reset
              </Button>
            )}
          </div>
        }
      />
      <SeamDivider />

      {lastResult && (
        <Card className="p-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs min-w-0">
              <div className="uppercase tracking-wide font-semibold text-mutedDim text-[10px] mb-0.5">Last result</div>
              <div className="truncate">
                <b>{lastResult.name}</b>{" "}
                {lastResult.sold
                  ? <span className="text-green">sold to {lastResult.teamName} for {fmt(lastResult.amount)} pts</span>
                  : <span className="text-red">unsold</span>}
              </div>
            </div>
            <Button variant="subtle" size="sm" disabled={busy}
              onClick={() => {
                const what = lastResult.sold ? `${lastResult.name} (sold to ${lastResult.teamName} for ${fmt(lastResult.amount)} pts)` : `${lastResult.name} (unsold)`;
                if (window.confirm(`Undo ${what}?\n\n${lastResult.sold ? `${lastResult.teamName} gets the points back, and ` : ""}${lastResult.name} comes back on the block for fresh bidding. Nothing else changes.`)) run(undoLastPlayerResult);
              }}>
              ↶ Undo {lastResult.name.split(" ")[0]}
            </Button>
          </div>
        </Card>
      )}

      {auction?.status === "paused" && (
        <Card className="p-3 mb-4 text-sm font-semibold text-center text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>Auction Paused</Card>
      )}

      {unsoldPlayers.length > 0 && auction?.status !== "completed" && (
        <Card className="p-4 mb-5">
          <button type="button" onClick={() => setShowQueue(!showQueue)} className="w-full flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-orange">📂 Unsold Queue ({unsoldPlayers.length})</span>
            <span className="text-[11px] text-mutedDim">{isUnsoldRound ? "Unsold again this round" : "Runs after the main list"} · {showQueue ? "Hide" : "Show"}</span>
          </button>
          {showQueue && (
            <div className="max-h-48 overflow-y-auto space-y-1 mt-3">
              {unsoldPlayers.map((p: any) => (
                <div key={p.id} className="flex justify-between text-xs py-1 border-b last:border-0 border-line">
                  <span>{p.full_name}</span>
                  <span className="text-mutedDim">{p.playing_role || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {auction?.status === "completed" && (
        <Card className="p-5 mb-5">
          <div className="text-sm font-bold uppercase tracking-wide mb-4 text-gold font-display">
            {isUnsoldRound ? "Unsold Round Complete" : "Main List Complete"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <StatCard label="Players This Round" value={summary.total} tone="gold" />
            <StatCard label="Sold" value={summary.sold} tone="green" />
            <StatCard label="Unsold" value={summary.unsold} tone="red" />
            <StatCard label="Points Spent" value={summary.totalSpent} tone="blue" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2 text-muted">Team Squad Completion</div>
          <div className="space-y-2 mb-5">
            {teamsWithStats.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-line">
                <span>{t.name}</span>
                <span className="text-muted">{t.squadCount}/{Number(t.max_squad_override || 0) || (settings?.max_squad_size ?? "—")} squad · {fmt(t.remaining)} pts left</span>
              </div>
            ))}
          </div>
          {unsoldPlayers.length > 0 ? (
            <div className="pt-4 border-t border-line">
              <div className="text-sm font-semibold mb-3">📂 {unsoldPlayers.length} player{unsoldPlayers.length === 1 ? " is" : "s are"} in the Unsold Queue.</div>
              <Button variant="primary" size="sm" className="w-full" disabled={busy}
                onClick={() => {
                  if (window.confirm(`Start the Unsold Round with all ${unsoldPlayers.length} players? They'll be shuffled into a new pool.`)) run(startUnsoldRound);
                }}>
                Start Unsold Round ({unsoldPlayers.length})
              </Button>
            </div>
          ) : (
            <div className="pt-4 border-t border-line text-sm text-mutedDim">The Unsold Queue is empty.</div>
          )}
        </Card>
      )}

      {!currentPlayer ? (
        <Card className="p-8 text-center text-sm text-mutedDim">
          {!auction?.pool_order?.length
            ? "Ready when you are. Press Start Auction to shuffle every approved player into a random order."
            : "All players in this list have been processed."}
        </Card>
      ) : (
        <>
          {flash && (
            <div className="rounded-2xl p-4 mb-5 text-center font-black text-2xl font-display tracking-wide"
              style={{
                background: flash === "sold" ? "rgba(61,220,151,0.15)" : "rgba(255,93,108,0.15)",
                border: `2px solid ${flash === "sold" ? "#3DDC97" : "#FF5D6C"}`,
                color: flash === "sold" ? "#3DDC97" : "#FF5D6C",
              }}>
              {flash === "sold" ? "SOLD! 🎉" : "UNSOLD"}
            </div>
          )}

          <div className="relative rounded-2xl p-5 mb-5 overflow-hidden" style={{ background: "#131D33", border: "1px solid #22304F" }}>
            <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 rounded-tl" style={{ borderColor: "#D4AF37" }} />
            <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 rounded-tr" style={{ borderColor: "#D4AF37" }} />
            <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 rounded-bl" style={{ borderColor: "#D4AF37" }} />
            <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 rounded-br" style={{ borderColor: "#D4AF37" }} />

            <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0" style={{ borderColor: "#D4AF37", boxShadow: "0 0 20px rgba(212,175,55,0.35)" }}>
                  {currentPlayer.photo_path ? (
                    <img src={supabase.storage.from("player-photos").getPublicUrl(currentPlayer.photo_path).data.publicUrl} alt={currentPlayer.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-gold">{(currentPlayer.full_name || "?").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-3xl font-bold font-display">{currentPlayer.full_name}</h2>
                  <div className="text-xs font-mono mt-0.5 text-mutedDim">
                    {currentPlayer.player_code}{computeAge(currentPlayer.dob) != null ? ` · ${computeAge(currentPlayer.dob)} yrs` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] text-mutedDim">
                {isUnsoldRound ? "Unsold Round · " : ""}Player {Number(auction.pool_index || 0) + 1} of {auction.pool_order.length}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
              <MiniRow label="Role" value={currentPlayer.playing_role} />
              <MiniRow label="Batting" value={currentPlayer.batting_style} />
              <MiniRow label="Bowling" value={currentPlayer.bowling_style} />
              <MiniRow label="District" value={currentPlayer.district} />
            </div>
            {(currentPlayer.cricheroes_matches || currentPlayer.cricheroes_runs || currentPlayer.cricheroes_wickets) && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatMini label="Matches" value={currentPlayer.cricheroes_matches} />
                <StatMini label="Runs" value={currentPlayer.cricheroes_runs} />
                <StatMini label="Wickets" value={currentPlayer.cricheroes_wickets} />
              </div>
            )}
            {currentPlayer.cricheroes_url && <a href={currentPlayer.cricheroes_url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline text-blue">CricHeroes Profile ↗</a>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-2xl p-6 text-center" style={{ background: "#131D33", border: "1px solid #22304F" }}>
              <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-mutedDim mb-1">Current Bid</div>
              <div className="digit-glow text-6xl font-black my-1 font-display text-goldBright">
                {fmt(currentBid)} <span className="text-lg text-mutedDim font-normal">pts</span>
              </div>
              <div className="text-base font-bold mt-2">{leadingTeam ? leadingTeam.name : "No bids yet"}</div>
              <div className="text-[10px] mt-1 h-3" style={{ color: saving ? "#F0C94A" : "#3DDC97" }}>
                {saving ? "saving…" : (auction.bid_history || []).length ? "✓ saved" : ""}
              </div>
            </div>
            <Card className="p-5">
              <div className="text-[11px] uppercase tracking-wide font-semibold mb-2 text-mutedDim">Bid History</div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {(auction.bid_history || []).length === 0 && <div className="text-xs text-mutedDim">No bids yet.</div>}
                {[...(auction.bid_history || [])].reverse().map((b: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted">{b.teamName}</span><span className="font-mono text-goldBright">{fmt(b.amount)} pts</span>
                  </div>
                ))}
              </div>
              <Button variant="subtle" size="sm" className="w-full mt-3" onClick={tryUndoBid} disabled={busy || !(auction.bid_history || []).length}>
                ↶ Undo Last Bid
              </Button>
            </Card>
          </div>

          <Card className="p-4 mb-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-mutedDim">Tap a Team to Bid</div>
              <div className="text-sm font-bold text-goldBright">
                {bidMaxReached ? `Maximum Bid Reached (${fmt(maxBid)} pts)` : `Next Bid — ${fmt(nextBidAmount)} pts`}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {teamsWithStats.map((t: any) => {
                const logo = t.logo_path ? supabase.storage.from("team-logos").getPublicUrl(t.logo_path).data.publicUrl : null;
                const isLeading = auction.current_team_id === t.id;
                return (
                  <button key={t.id} onClick={() => tapTeam(t.id)} disabled={busy || bidMaxReached || auction.status !== "live"}
                    className="rounded-xl p-3 text-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: isLeading ? "rgba(61,220,151,0.12)" : "#131D33", border: isLeading ? "2px solid #3DDC97" : "1px solid #22304F" }}>
                    <div className="w-12 h-12 rounded-lg mx-auto mb-1.5 overflow-hidden bg-bgCardHover flex items-center justify-center">
                      {logo ? <img src={logo} alt={t.name} className="w-full h-full object-contain p-1" /> : <span className="text-sm font-bold text-gold">{(t.name || "").slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="text-xs font-bold truncate">{t.name}</div>
                    <div className="text-[10px] text-mutedDim">{fmt(t.remaining)} pts left</div>
                    <div className="text-[10px] text-mutedDim">{t.squadCount}/{Number(t.max_squad_override || 0) || (settings?.max_squad_size ?? "—")} squad</div>
                  </button>
                );
              })}
            </div>

            {/* Manual bid — for a jump bid the tiers don't cover. */}
            <div className="rounded-xl p-3 mb-3" style={{ background: "#0E1628", border: "1px solid #22304F" }}>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-mutedDim mb-2">Manual Bid</div>
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label={`Amount (multiples of ${fmt(STEP)})`}>
                  <input type="number" min={STEP} step={STEP} value={manualAmount} placeholder={String(nextBidAmount)}
                    onChange={(e: any) => setManualAmount(e.target.value)} />
                </Field>
                <Field label="Bidding Team">
                  <select value={manualTeam} onChange={(e: any) => setManualTeam(e.target.value)}>
                    <option value="">Select team</option>
                    {teamsWithStats.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({fmt(t.remaining)} pts left)</option>)}
                  </select>
                </Field>
                <Button variant="primary" onClick={submitManualBid} disabled={busy || auction.status !== "live" || !manualAmount || !manualTeam}>
                  Place Bid
                </Button>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {[1000, 2000, 5000, 10000].map((step) => (
                  <button key={step} type="button"
                    onClick={() => setManualAmount(String(Math.max(STEP, (Number(manualAmount) || currentBid) + step)))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-line text-mutedDim">
                    +{fmt(step)}
                  </button>
                ))}
                <button type="button" onClick={() => setManualAmount("")} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-line text-mutedDim">Clear</button>
              </div>
            </div>

            {msg && <div className="text-xs font-semibold mb-2 text-red">⚠ {msg}</div>}
            {canOverride ? (
              <label className="flex items-center gap-2 text-xs mb-3 text-mutedDim">
                <input type="checkbox" className="!w-auto" checked={override} onChange={(e: any) => setOverride(e.target.checked)} /> Super Admin override (ignore squad/quota/purse limits)
              </label>
            ) : (
              <div className="text-[11px] mb-3 text-mutedDim">Only Super Admin can override squad, guest quota or purse limits.</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => flashResult("sold", () => markSold(override))} disabled={!auction.current_team_id || busy}>SOLD</Button>
              <Button variant="danger" onClick={() => flashResult("unsold", markUnsold)} disabled={busy}>UNSOLD</Button>
              <Button variant="ghost" size="sm" className="col-span-2" onClick={() => run(deferPlayer)} disabled={busy}>DEFER PLAYER</Button>
            </div>
          </Card>
        </>
      )}

      <PurseGrid teams={teamsWithStats} settings={settings} />
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1">
      <span className="text-mutedDim">{label}</span><span>{value || "—"}</span>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg bg-bgCardHover border border-line py-2 text-center">
      <div className="text-lg font-bold font-display text-goldBright">{value ?? "—"}</div>
      <div className="text-[10px] uppercase tracking-wide text-mutedDim">{label}</div>
    </div>
  );
}

function PurseGrid({ teams, settings }: { teams: any[]; settings: any }) {
  return (
    <>
      <div className="text-xs font-bold uppercase tracking-wide mb-3 text-muted">Team Purses</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {teams.map((t) => (
          <Card key={t.id} className="p-3">
            <div className="text-sm font-bold truncate">{t.name}</div>
            <div className={`text-lg font-bold font-display ${t.remaining < 0 ? "text-red" : "text-goldBright"}`}>{fmt(t.remaining)} pts</div>
            <div className="text-[11px] text-mutedDim">{t.squadCount}/{Number(t.max_squad_override || 0) || (settings?.max_squad_size ?? "—")} squad · {t.guestCount}/{settings?.guest_quota ?? "—"} guests</div>
          </Card>
        ))}
      </div>
    </>
  );
}
