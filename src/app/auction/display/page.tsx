"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Public, unauthenticated route. Only reads from player_public / team_public
// / auction_state — none of which ever include Emirates ID, contact info,
// or payment data (see the views + grants in supabase/migrations/0003_rls.sql
// and 0001_schema.sql). This satisfies item: "Never send Emirates ID,
// contact or payment information to this page" structurally, not just by
// UI convention.
export default function AuctionDisplayPage() {
  const supabase = createClient();
  const [auction, setAuction] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [remainingPts, setRemainingPts] = useState<number | null>(null);

  async function refresh(a?: any) {
    const state = a ?? (await supabase.from("auction_state").select("*").eq("id", 1).single()).data;
    setAuction(state);

    if (state?.current_player_id) {
      const { data: p } = await supabase.from("player_public").select("*").eq("id", state.current_player_id).single();
      setPlayer(p);
    } else {
      setPlayer(null);
    }

    if (state?.current_team_id) {
      const { data: t } = await supabase.from("team_public").select("*").eq("id", state.current_team_id).single();
      setTeam(t);
      if (t) {
        const { data: sold } = await supabase.from("player_public").select("sold_points").eq("team_id", t.id).eq("application_status", "Sold / Selected");
        const spent = (sold ?? []).reduce((s, x) => s + Number(x.sold_points || 0), 0);
        setRemainingPts(Number(t.auction_points || 0) - spent);
      }
    } else {
      setTeam(null);
      setRemainingPts(null);
    }
  }

  useEffect(() => {
    supabase.from("tournament_settings").select("tournament_name, season, country").eq("id", 1).single().then(({ data }) => setSettings(data));
    refresh();

    const channel = supabase
      .channel("auction-display")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state", filter: "id=eq.1" }, (payload) => {
        refresh(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBanner = auction?.last_action && Date.now() - auction.last_action.ts < 6000;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative bg-[radial-gradient(circle_at_50%_0%,#16213D_0%,#0A0F1C_65%)]">
      <div className="text-center mb-6">
        <div className="text-[11px] uppercase tracking-[0.3em] font-semibold mb-1 text-orange">{settings?.season} · {settings?.country}</div>
        <div className="text-2xl sm:text-3xl font-bold font-display text-gold">{settings?.tournament_name}</div>
      </div>

      {showBanner && (
        <div
          className="mb-6 px-8 py-4 rounded-2xl text-center animate-pulse border-2"
          style={{
            background: auction.last_action.type === "SOLD" ? "rgba(61,220,151,0.15)" : "rgba(255,93,108,0.15)",
            borderColor: auction.last_action.type === "SOLD" ? "#3DDC97" : "#FF5D6C",
          }}
        >
          <div className={`text-4xl font-black tracking-wide font-display ${auction.last_action.type === "SOLD" ? "text-green" : "text-red"}`}>{auction.last_action.type}</div>
          <div className="text-lg font-semibold mt-1">{auction.last_action.playerName}</div>
          {auction.last_action.type === "SOLD" && <div className="text-sm mt-1 text-goldBright">{auction.last_action.teamName} · {auction.last_action.amount} pts</div>}
        </div>
      )}

      {!player ? (
        <div className="rounded-xl border border-line bg-bgCard p-10 text-center max-w-md">
          <div className="text-xl font-bold mb-2 font-display">{!auction?.pool_order?.length ? "Auction has not started yet" : "Auction Complete"}</div>
          <div className="text-sm text-mutedDim">Stay tuned for the next update.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-bgCard p-8 max-w-xl w-full text-center">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-gold/15 text-goldBright">{player.auction_category || "Unassigned"}</span>
          <div className="w-24 h-24 rounded-full mx-auto my-4 flex items-center justify-center text-4xl font-bold border-3 border-gold bg-bgCardHover text-gold">
            {(player.full_name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="text-3xl font-bold font-display">{player.full_name}</div>
          <div className="text-sm mt-1 text-muted">{player.playing_role} · {player.batting_style}{player.bowling_style ? ` · ${player.bowling_style}` : ""}</div>
          <div className="text-xs mt-1 text-mutedDim">{player.district || player.state}</div>

          <div className="flex items-center gap-1 my-4">
            <div className="flex-1 h-px bg-line" />
            <span className="text-mutedDim text-xs">✦</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-mutedDim">Current Bid</div>
              <div className="text-5xl font-black font-display text-goldBright">{auction?.current_bid || 0}</div>
              <div className="text-xs text-mutedDim">points</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-mutedDim">Leading Team</div>
              <div className="text-2xl font-bold mt-2 font-display">{team ? team.name : "—"}</div>
              {team && <div className="text-xs text-mutedDim">{remainingPts} pts remaining</div>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-[11px] text-mutedDim">
        {auction?.pool_order?.length ? `Player ${auction.pool_index + 1} of ${auction.pool_order.length}` : ""}
      </div>
    </div>
  );
}
