"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeAge } from "@/lib/constants";

// Public, read-only live auction screen for fans and the big screen at the
// venue. It mirrors the admin Control Room (player on the block, current
// bid, leading team, bid history, every team's purse and squad) with no
// buttons. It only reads player_public / team_public / auction_state, none
// of which include Emirates ID, contact or payment details.
//
// Speed: each bid arrives through the live feed and is shown immediately
// from that message. Player details are cached, and team purses are only
// re-counted when a player is SOLD/UNSOLD or undone, not on every bid.
export default function AuctionDisplayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [auction, setAuction] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<any[]>([]);
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [banner, setBanner] = useState<any>(null);
  const lastResultTs = useRef<number | null>(null);
  const bannerTimer = useRef<any>(null);

  async function loadTeamsAndSquads() {
    const [{ data: t }, { data: sold }, { count }] = await Promise.all([
      supabase.from("team_public").select("*"),
      supabase.from("player_public").select("id, team_id, sold_points").eq("application_status", "Sold / Selected"),
      supabase.from("player_public").select("id", { count: "exact", head: true }).eq("application_status", "Unsold / Not Selected"),
    ]);
    setTeams(t ?? []);
    setSquadPlayers(sold ?? []);
    setUnsoldCount(count ?? 0);
  }

  const requested = useRef<Set<string>>(new Set());
  function ensurePlayer(id: string | null) {
    if (!id || requested.current.has(id)) return;
    requested.current.add(id);
    supabase.from("player_public").select("*").eq("id", id).single().then(({ data }: any) => {
      if (data) setPlayers((p) => ({ ...p, [id]: data }));
      else requested.current.delete(id);
    });
  }

  function onAuction(next: any) {
    setAuction(next);
    ensurePlayer(next?.current_player_id ?? null);
    // Preload the next player so the switch after SOLD is instant.
    const upcoming = next?.pool_order?.[Number(next?.pool_index ?? 0) + 1];
    if (upcoming) ensurePlayer(upcoming);

    const ts = next?.last_action?.ts ?? null;
    if (ts !== lastResultTs.current) {
      const first = lastResultTs.current === null;
      lastResultTs.current = ts;
      loadTeamsAndSquads();
      if (!first && next?.last_action) {
        setBanner(next.last_action);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      }
    }
  }

  useEffect(() => {
    supabase.from("tournament_settings").select("tournament_name, season, country, max_squad_size").eq("id", 1).single()
      .then(({ data }: any) => setSettings(data));
    supabase.from("auction_state").select("*").eq("id", 1).single().then(({ data }: any) => { onAuction(data); loadTeamsAndSquads(); });

    const channel = supabase
      .channel("auction-display")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state", filter: "id=eq.1" }, (payload: any) => onAuction(payload.new))
      .subscribe();
    // Safety net in case the live feed drops on the venue Wi-Fi.
    const timer = setInterval(() => {
      supabase.from("auction_state").select("*").eq("id", 1).single().then(({ data }: any) => { if (data) onAuction(data); });
    }, 15000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); clearTimeout(bannerTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const player = auction?.current_player_id ? players[auction.current_player_id] : null;
  const photoUrl = (path: string | null) => (path ? supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl : null);
  const logoUrl = (path: string | null) => (path ? supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl : null);

  const teamStats = teams.map((t: any) => {
    const squad = squadPlayers.filter((p: any) => p.team_id === t.id);
    const spent = squad.reduce((s: number, p: any) => s + Number(p.sold_points || 0), 0);
    return { ...t, remaining: Number(t.auction_points || 0) - spent, squadCount: squad.length };
  });
  const leading = teamStats.find((t: any) => t.id === auction?.current_team_id) || null;
  const history: any[] = [...(auction?.bid_history || [])].reverse();
  const isUnsoldRound = auction?.round === "Unsold";
  const age = player ? computeAge(player.dob) : null;

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-[radial-gradient(ellipse_900px_500px_at_50%_0%,#16213D_0%,#0A0F1C_55%,#05070d_100%)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-orange">
              {[settings?.season, settings?.country].filter(Boolean).join(" · ")}
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-gold">{settings?.tournament_name} · Live Auction</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {auction?.status === "live" && (
              <span className="flex items-center gap-1.5 font-extrabold tracking-wider px-3 py-1.5 rounded-full" style={{ color: "#FF6B78", background: "rgba(255,77,94,0.12)" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#FF4D5E" }} /> LIVE
              </span>
            )}
            {auction?.pool_order?.length > 0 && (
              <span className="px-3 py-1.5 rounded-full text-mutedDim border border-line">
                {isUnsoldRound ? "Unsold Round" : "Main List"}{auction.current_player_id ? ` · Player ${auction.pool_index + 1} of ${auction.pool_order.length}` : ""}
              </span>
            )}
            {unsoldCount > 0 && !isUnsoldRound && (
              <span className="px-3 py-1.5 rounded-full border" style={{ color: "#FF9A66", borderColor: "rgba(255,122,61,0.35)" }}>📂 Unsold Queue {unsoldCount}</span>
            )}
          </div>
        </div>

        {auction?.status === "paused" && (
          <div className="rounded-xl p-3 mb-4 text-sm font-semibold text-center text-orange border" style={{ borderColor: "rgba(255,122,61,0.3)" }}>Auction paused. Back shortly!</div>
        )}

        {banner && (
          <div className="rounded-2xl p-5 mb-5 text-center border-2"
            style={{
              background: banner.type === "SOLD" ? "rgba(61,220,151,0.15)" : "rgba(255,93,108,0.15)",
              borderColor: banner.type === "SOLD" ? "#3DDC97" : "#FF5D6C",
            }}>
            <div className={`text-5xl font-black tracking-wide font-display ${banner.type === "SOLD" ? "text-green" : "text-red"}`}>
              {banner.type === "SOLD" ? "SOLD! 🎉" : "UNSOLD"}
            </div>
            <div className="text-xl font-semibold mt-1">{banner.playerName}</div>
            {banner.type === "SOLD" && <div className="text-base mt-1 text-goldBright">{banner.teamName} · {banner.amount} pts</div>}
          </div>
        )}

        {!auction?.current_player_id ? (
          <div className="rounded-2xl border border-gold/25 bg-bgCard p-10 text-center max-w-md mx-auto mb-6" style={{ boxShadow: "0 0 60px rgba(212,175,55,0.08)" }}>
            <div className="text-3xl font-black mb-2 font-display text-goldBright">
              {!auction?.pool_order?.length ? "Coming Soon" : isUnsoldRound ? "Unsold Round Complete" : "Main List Complete"}
            </div>
            <div className="text-sm text-mutedDim">
              {!auction?.pool_order?.length
                ? "The live auction hasn't begun yet. Check back soon."
                : unsoldCount > 0
                  ? `${unsoldCount} player${unsoldCount === 1 ? "" : "s"} in the Unsold Queue. The Unsold Round starts shortly.`
                  : "All players have been auctioned. Thanks for watching!"}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-4 mb-6">
            {/* Player on the block */}
            <div className="lg:col-span-3 relative rounded-2xl p-6 overflow-hidden" style={{ background: "#131D33", border: "1px solid #22304F" }}>
              <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 rounded-tl" style={{ borderColor: "#D4AF37" }} />
              <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 rounded-tr" style={{ borderColor: "#D4AF37" }} />
              <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 rounded-bl" style={{ borderColor: "#D4AF37" }} />
              <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 rounded-br" style={{ borderColor: "#D4AF37" }} />
              {!player ? (
                <div className="text-center text-sm text-mutedDim py-16">Loading player…</div>
              ) : (
                <>
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 bg-bgCardHover"
                      style={{ borderColor: "#D4AF37", boxShadow: "0 0 30px rgba(212,175,55,0.35)" }}>
                      {photoUrl(player.photo_path)
                        ? <img src={photoUrl(player.photo_path)!} alt={player.full_name} className="w-full h-full object-cover" />
                        : <span className="text-5xl font-bold text-gold">{(player.full_name || "?").slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-gold/15 text-goldBright">{player.auction_category || "Unassigned"}</span>
                      <div className="text-3xl sm:text-4xl font-bold font-display mt-2">{player.full_name}</div>
                      <div className="text-xs font-mono mt-1 text-mutedDim">{player.player_code}{age != null ? ` · ${age} yrs` : ""}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm mt-5">
                    {[["Role", player.playing_role], ["Batting", player.batting_style], ["Bowling", player.bowling_style], ["District", player.district || player.state]].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between border-b border-line py-1.5">
                        <span className="text-mutedDim">{l}</span><span className="text-right">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                  {(player.cricheroes_matches || player.cricheroes_runs || player.cricheroes_wickets) && (
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      {[["Matches", player.cricheroes_matches], ["Runs", player.cricheroes_runs], ["Wickets", player.cricheroes_wickets]].map(([l, v]) => (
                        <div key={l as string} className="rounded-xl bg-bgCardHover border border-line py-3 text-center">
                          <div className="text-2xl font-black font-display text-goldBright">{v ?? "—"}</div>
                          <div className="text-[10px] uppercase tracking-wide text-mutedDim mt-0.5">{l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Current bid + history */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="rounded-2xl p-6 text-center" style={{ background: "#131D33", border: leading ? "2px solid #3DDC97" : "1px solid #22304F" }}>
                <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-mutedDim mb-1">Current Bid</div>
                <div className="digit-glow text-7xl font-black my-1 font-display text-goldBright">
                  {auction.current_bid || 0} <span className="text-xl text-mutedDim font-normal">pts</span>
                </div>
                {leading ? (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {logoUrl(leading.logo_path) && <img src={logoUrl(leading.logo_path)!} alt="" className="w-9 h-9 object-contain rounded bg-white/5 p-0.5" />}
                    <div className="text-left">
                      <div className="text-lg font-bold">{leading.name}</div>
                      <div className="text-[11px] text-mutedDim">{leading.remaining} pts left · {leading.squadCount}{settings?.max_squad_size ? `/${settings.max_squad_size}` : ""} squad</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-base font-bold mt-2 text-mutedDim">No bids yet</div>
                )}
              </div>
              <div className="rounded-2xl p-5 flex-1" style={{ background: "#131D33", border: "1px solid #22304F" }}>
                <div className="text-[11px] uppercase tracking-wide font-semibold mb-2 text-mutedDim">Bid History</div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {history.length === 0 && <div className="text-xs text-mutedDim">Waiting for the first bid…</div>}
                  {history.map((b: any, i: number) => (
                    <div key={`${b.ts}-${i}`} className={`flex justify-between text-sm ${i === 0 ? "font-bold" : ""}`}>
                      <span className={i === 0 ? "" : "text-muted"}>{b.teamName}</span>
                      <span className="font-mono text-goldBright">{b.amount} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Every team, like the Control Room tiles (read-only) */}
        {teamStats.length > 0 && (
          <div>
            <div className="text-center text-[10px] uppercase tracking-[0.3em] text-mutedDim mb-3">Teams</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {teamStats.map((t: any) => {
                const isLeading = auction?.current_team_id === t.id;
                const logo = logoUrl(t.logo_path);
                return (
                  <div key={t.id} className="rounded-xl p-3 text-center"
                    style={{ background: isLeading ? "rgba(61,220,151,0.12)" : "#131D33", border: isLeading ? "2px solid #3DDC97" : "1px solid #22304F" }}>
                    <div className="w-12 h-12 rounded-lg mx-auto mb-1.5 overflow-hidden bg-bgCardHover flex items-center justify-center">
                      {logo ? <img src={logo} alt={t.name} className="w-full h-full object-contain p-1" /> : <span className="text-sm font-bold text-gold">{(t.name || "").slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="text-xs font-bold truncate">{t.name}</div>
                    <div className={`text-sm font-black font-display ${t.remaining < 0 ? "text-red" : "text-goldBright"}`}>{t.remaining} pts</div>
                    <div className="text-[10px] text-mutedDim">{t.squadCount}{settings?.max_squad_size ? `/${settings.max_squad_size}` : ""} squad</div>
                    {isLeading && <div className="text-[10px] font-bold mt-0.5" style={{ color: "#3DDC97" }}>LEADING</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
