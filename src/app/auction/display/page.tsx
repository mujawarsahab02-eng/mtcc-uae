"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeAge } from "@/lib/constants";

// MTCC live auction broadcast screen (Display Mode).
// Public and read-only: it only reads auction_state, player_public and
// team_public, which never include Emirates ID, contact or payment data.
//
// Built for event day, so it is deliberately stubborn:
//  - the live feed updates the bid the instant it changes, and
//  - a 2-second poll refreshes everything anyway, so the screen is never
//    more than 2 seconds stale even if the live feed is blocked on the
//    venue Wi-Fi, and
//  - every value has a safe default, so a missing team or player can never
//    blank the screen.
const GOLD_TEXT: any = {
  background: "linear-gradient(180deg, #FFF3C4 0%, #F4CF5B 38%, #C9962A 72%, #F0C94A 100%)",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
};
const PANEL: any = {
  background: "linear-gradient(180deg, rgba(17,27,50,0.94) 0%, rgba(8,13,26,0.96) 100%)",
  border: "1px solid rgba(212,175,55,0.55)",
  boxShadow: "inset 0 1px 0 rgba(255,236,170,0.12), 0 12px 40px rgba(0,0,0,0.55)",
};
const fmt = (n: any) => Number(n || 0).toLocaleString("en-US");

function nextIncrement(currentBid: number, s: any) {
  if (!currentBid) return s?.auction_starting_bid ?? 2000;
  if (currentBid >= (s?.auction_tier4_threshold ?? 20000)) return s?.auction_tier4_increment ?? 5000;
  if (currentBid >= (s?.auction_tier3_threshold ?? 15000)) return s?.auction_tier3_increment ?? 3000;
  if (currentBid >= (s?.auction_tier2_threshold ?? 10000)) return s?.auction_tier2_increment ?? 2000;
  return s?.auction_bid_increment ?? 1000;
}

function GoldCorners() {
  const c = "absolute w-5 h-5 border-[#D4AF37]";
  return (
    <>
      <span className={`${c} top-1.5 left-1.5 border-t-2 border-l-2 rounded-tl`} />
      <span className={`${c} top-1.5 right-1.5 border-t-2 border-r-2 rounded-tr`} />
      <span className={`${c} bottom-1.5 left-1.5 border-b-2 border-l-2 rounded-bl`} />
      <span className={`${c} bottom-1.5 right-1.5 border-b-2 border-r-2 rounded-br`} />
    </>
  );
}

function PanelTitle({ icon, children }: { icon: string; children: any }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
      <span className="text-lg leading-none">{icon}</span>
      <span className="font-display font-black uppercase tracking-wide text-[clamp(13px,1.05vw,20px)]" style={GOLD_TEXT}>{children}</span>
    </div>
  );
}

export default function AuctionDisplayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [auction, setAuction] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [soldPlayers, setSoldPlayers] = useState<any[]>([]);
  const [poolStatus, setPoolStatus] = useState<Record<string, string>>({});
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [banner, setBanner] = useState<any>(null);

  const auctionRef = useRef<any>(null);
  const lastResultTs = useRef<any>(undefined);
  const bannerTimer = useRef<any>(null);
  const requested = useRef<Record<string, boolean>>({});

  async function ensurePlayer(id: string | null) {
    if (!id || requested.current[id]) return;
    requested.current[id] = true;
    try {
      const { data } = await supabase.from("player_public").select("*").eq("id", id).maybeSingle();
      if (data) setPlayers((p) => ({ ...p, [id]: data }));
      else delete requested.current[id];
    } catch {
      delete requested.current[id];
    }
  }

  // Two clocks. The fast one asks a single question — "what is the auction
  // doing?" — which is one tiny row carrying the bid, the player AND the
  // team table the server worked out at the moment of sale. That row is all
  // the live screen needs, so it can be asked twice a second.
  const inFlight = useRef(false);
  async function tickFast() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data } = await supabase.from("auction_state").select("*").eq("id", 1).maybeSingle();
      if (data) applyAuction(data);
    } catch {
      // Ignored — the next tick, half a second later, tries again.
    } finally {
      inFlight.current = false;
    }
  }

  // The slow one is only a fallback, for the moments before the first sale
  // of the day when the server hasn't written a team table yet.
  async function tickSlow() {
    try {
      const pool: string[] = auctionRef.current?.pool_order || [];
      const [teamRes, soldRes, unsoldRes, poolRes] = await Promise.all([
        supabase.from("team_public").select("*"),
        supabase.from("player_public").select("id, team_id, sold_points").eq("application_status", "Sold / Selected"),
        supabase.from("player_public").select("id", { count: "exact", head: true }).eq("application_status", "Unsold / Not Selected"),
        pool.length ? supabase.from("player_public").select("id, application_status").in("id", pool) : Promise.resolve({ data: [] }),
      ]);
      if (teamRes?.data) setTeams(teamRes.data);
      if (soldRes?.data) setSoldPlayers(soldRes.data);
      setUnsoldCount(unsoldRes?.count ?? 0);
      const map: Record<string, string> = {};
      for (const r of poolRes?.data ?? []) map[r.id] = r.application_status;
      setPoolStatus(map);
    } catch {
      // Ignored — the next pass in a few seconds tries again.
    }
  }

  function applyAuction(next: any) {
    if (!next) return;
    auctionRef.current = next;
    setAuction(next);
    ensurePlayer(next.current_player_id ?? null);
    const upcoming = next.pool_order?.[Number(next.pool_index ?? 0) + 1];
    if (upcoming) ensurePlayer(upcoming);

    const ts = next.last_action?.ts ?? null;
    if (ts !== lastResultTs.current) {
      const first = lastResultTs.current === undefined;
      lastResultTs.current = ts;
      // Don't replay an old result when the screen is first opened.
      if (!first && next.last_action) {
        setBanner(next.last_action);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 6000);
      }
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("tournament_settings").select("*").eq("id", 1).maybeSingle();
        if (data) setSettings(data);
      } catch {
        // Ignored — the screen still runs on its built-in defaults.
      }
    })();
    tickFast();
    tickSlow();

    // The live feed puts a bid on screen in a few hundredths of a second.
    const channel = supabase
      .channel("auction-display")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state", filter: "id=eq.1" }, (payload: any) => applyAuction(payload.new))
      .subscribe();
    const fast = setInterval(tickFast, 500);
    const slow = setInterval(tickSlow, 6000);
    return () => { supabase.removeChannel(channel); clearInterval(fast); clearInterval(slow); clearTimeout(bannerTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photoUrl = (path: string | null) => {
    try { return path ? supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl : null; } catch { return null; }
  };
  const logoUrl = (path: string | null) => {
    try { return path ? supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl : null; } catch { return null; }
  };

  const player = auction?.current_player_id ? players[auction.current_player_id] : null;
  const nextPlayerId = auction?.pool_order?.[Number(auction?.pool_index ?? 0) + 1];
  const nextPlayer = nextPlayerId ? players[nextPlayerId] : null;
  const maxSquad = Number(settings?.max_squad_size || 0);

  // The server writes the team table into auction_state at the moment of
  // each sale, so these numbers arrive with the same message as the bid and
  // match the Control Room exactly. The local calculation below is only a
  // stand-in for before the first sale of the day.
  const serverStats: any[] = Array.isArray(auction?.team_stats) ? auction.team_stats : [];
  const teamStats = serverStats.length ? serverStats : (teams || []).map((t: any) => {
    const squad = (soldPlayers || []).filter((p: any) => p.team_id === t.id);
    const spent = squad.reduce((s: number, p: any) => s + Number(p.sold_points || 0), 0);
    const total = Number(t.auction_points || 0);
    return { ...t, total, spent, remaining: total - spent, bought: squad.filter((p: any) => (p.team_role ?? "Auction Player") === "Auction Player").length, squad: squad.length, max: (Number(t.max_squad_override || 0) || maxSquad) || null, slots: (Number(t.max_squad_override || 0) || maxSquad) ? Math.max(0, (Number(t.max_squad_override || 0) || maxSquad) - squad.length) : null };
  });
  const leading = teamStats.find((t: any) => t.id === auction?.current_team_id) || null;
  const bidHistory: any[] = auction?.bid_history || [];
  const bidTeamIds: Record<string, boolean> = {};
  for (const b of bidHistory) if (b?.teamId) bidTeamIds[b.teamId] = true;

  const currentBid = Number(auction?.current_bid || 0);
  const basePrice = settings?.auction_starting_bid ?? 2000;
  const increment = nextIncrement(currentBid, settings);
  const age = player ? computeAge(player.dob) : null;
  const isUnsoldRound = auction?.round === "Unsold";

  const pool: string[] = auction?.pool_order || [];
  const roundStats = auction?.round_stats || null;
  const soldInRound = roundStats ? Number(roundStats.sold || 0) : pool.filter((id) => poolStatus[id] === "Sold / Selected").length;
  const queueCount = roundStats ? Number(roundStats.queue || 0) : unsoldCount;
  const remainingInRound = auction?.current_player_id ? pool.length - Number(auction.pool_index || 0) : 0;
  const lastSold = auction?.last_action?.type === "SOLD" ? auction.last_action : null;
  const dateText = settings?.auction_date
    ? new Date(settings.auction_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="relative min-h-screen lg:h-screen overflow-hidden text-white flex flex-col"
      style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, #1B2A4D 0%, #0B1224 45%, #04070F 100%)" }}>
      <div className="absolute -top-24 -left-24 w-[40vw] h-[40vw] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,240,200,0.22) 0%, rgba(255,240,200,0) 60%)" }} />
      <div className="absolute -top-24 -right-24 w-[40vw] h-[40vw] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,240,200,0.22) 0%, rgba(255,240,200,0) 60%)" }} />
      <svg viewBox="0 0 1300 330" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 w-full h-[44%] opacity-[0.2] pointer-events-none">
        <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.95" /><stop offset="100%" stopColor="#0A0F1C" stopOpacity="0.2" />
        </linearGradient></defs>
        <g fill="url(#skyg)">
          <rect key="0" x={0} y={270} width={40} height={60} /><rect key="1" x={45} y={240} width={30} height={90} /><rect key="2" x={80} y={260} width={26} height={70} /><rect key="3" x={110} y={210} width={22} height={120} /><rect key="4" x={136} y={250} width={34} height={80} /><rect key="5" x={175} y={190} width={20} height={140} /><rect key="6" x={200} y={235} width={30} height={95} /><rect key="7" x={236} y={170} width={18} height={160} /><rect key="8" x={260} y={220} width={28} height={110} /><rect key="9" x={292} y={255} width={34} height={75} /><rect key="10" x={330} y={200} width={24} height={130} /><rect key="11" x={360} y={240} width={30} height={90} /><rect key="12" x={640} y={230} width={30} height={100} /><rect key="13" x={676} y={180} width={22} height={150} /><rect key="14" x={704} y={245} width={34} height={85} /><rect key="15" x={744} y={205} width={26} height={125} /><rect key="16" x={776} y={160} width={18} height={170} /><rect key="17" x={800} y={235} width={32} height={95} /><rect key="18" x={838} y={190} width={24} height={140} /><rect key="19" x={868} y={250} width={36} height={80} /><rect key="20" x={910} y={215} width={26} height={115} /><rect key="21" x={942} y={260} width={40} height={70} /><rect key="22" x={988} y={230} width={30} height={100} /><rect key="23" x={1024} y={270} width={40} height={60} /><rect key="24" x={1070} y={200} width={22} height={130} /><rect key="25" x={1098} y={245} width={34} height={85} /><rect key="26" x={1138} y={225} width={28} height={105} /><rect key="27" x={1172} y={265} width={40} height={65} /><rect key="28" x={1218} y={240} width={30} height={90} /><rect key="29" x={1254} y={275} width={46} height={55} />
          <polygon points="470,330 470,190 480,190 482,120 490,120 493,40 497,0 501,40 504,120 512,120 514,190 524,190 524,330" />
          <polygon points="420,330 420,210 438,200 456,210 456,330" />
          <path d="M560 330 L560 150 Q610 175 606 330 Z" />
        </g>
      </svg>
      <span className="p" style={{ left: "41%", bottom: "-30%", width: 4, height: 6, animationDuration: "9s", animationDelay: "-2s", opacity: 0.15 }} />
<span className="p" style={{ left: "46%", bottom: "-18%", width: 3, height: 4, animationDuration: "9s", animationDelay: "-2s", opacity: 0.4 }} />
<span className="p" style={{ left: "53%", bottom: "-2%", width: 4, height: 3, animationDuration: "17s", animationDelay: "-13s", opacity: 0.15 }} />
<span className="p" style={{ left: "72%", bottom: "-3%", width: 4, height: 3, animationDuration: "18s", animationDelay: "-18s", opacity: 0.4 }} />
<span className="p" style={{ left: "6%", bottom: "-7%", width: 3, height: 4, animationDuration: "13s", animationDelay: "-13s", opacity: 0.22 }} />
<span className="p" style={{ left: "69%", bottom: "-3%", width: 5, height: 4, animationDuration: "10s", animationDelay: "-18s", opacity: 0.22 }} />
<span className="p" style={{ left: "47%", bottom: "-3%", width: 3, height: 3, animationDuration: "18s", animationDelay: "-6s", opacity: 0.4 }} />
<span className="p" style={{ left: "87%", bottom: "-17%", width: 6, height: 5, animationDuration: "16s", animationDelay: "-18s", opacity: 0.4 }} />
<span className="p" style={{ left: "46%", bottom: "-9%", width: 4, height: 4, animationDuration: "12s", animationDelay: "-2s", opacity: 0.3 }} />
<span className="p" style={{ left: "67%", bottom: "-15%", width: 5, height: 6, animationDuration: "13s", animationDelay: "-2s", opacity: 0.15 }} />
<span className="p" style={{ left: "65%", bottom: "-13%", width: 4, height: 5, animationDuration: "11s", animationDelay: "-15s", opacity: 0.4 }} />
<span className="p" style={{ left: "5%", bottom: "-30%", width: 3, height: 5, animationDuration: "14s", animationDelay: "-11s", opacity: 0.4 }} />
<span className="p" style={{ left: "74%", bottom: "-25%", width: 6, height: 3, animationDuration: "10s", animationDelay: "-8s", opacity: 0.4 }} />
<span className="p" style={{ left: "89%", bottom: "-21%", width: 3, height: 3, animationDuration: "13s", animationDelay: "-18s", opacity: 0.4 }} />
<span className="p" style={{ left: "36%", bottom: "-22%", width: 6, height: 5, animationDuration: "9s", animationDelay: "-14s", opacity: 0.3 }} />
<span className="p" style={{ left: "21%", bottom: "-19%", width: 3, height: 6, animationDuration: "9s", animationDelay: "-6s", opacity: 0.3 }} />
<span className="p" style={{ left: "16%", bottom: "-23%", width: 4, height: 6, animationDuration: "15s", animationDelay: "-15s", opacity: 0.15 }} />
<span className="p" style={{ left: "21%", bottom: "-14%", width: 6, height: 5, animationDuration: "11s", animationDelay: "-13s", opacity: 0.3 }} />
<span className="p" style={{ left: "90%", bottom: "-13%", width: 5, height: 6, animationDuration: "12s", animationDelay: "-4s", opacity: 0.15 }} />
<span className="p" style={{ left: "22%", bottom: "-4%", width: 4, height: 4, animationDuration: "9s", animationDelay: "-15s", opacity: 0.22 }} />
<span className="p" style={{ left: "33%", bottom: "-9%", width: 3, height: 4, animationDuration: "15s", animationDelay: "-17s", opacity: 0.3 }} />
<span className="p" style={{ left: "78%", bottom: "-18%", width: 5, height: 4, animationDuration: "17s", animationDelay: "-1s", opacity: 0.4 }} />
<span className="p" style={{ left: "99%", bottom: "-30%", width: 6, height: 6, animationDuration: "15s", animationDelay: "-12s", opacity: 0.15 }} />
<span className="p" style={{ left: "61%", bottom: "-20%", width: 6, height: 3, animationDuration: "12s", animationDelay: "-2s", opacity: 0.22 }} />
<span className="p" style={{ left: "56%", bottom: "-5%", width: 3, height: 5, animationDuration: "18s", animationDelay: "-1s", opacity: 0.15 }} />
<span className="p" style={{ left: "0%", bottom: "-18%", width: 4, height: 3, animationDuration: "14s", animationDelay: "-0s", opacity: 0.15 }} />
<span className="p" style={{ left: "26%", bottom: "-19%", width: 6, height: 4, animationDuration: "13s", animationDelay: "-11s", opacity: 0.3 }} />
<span className="p" style={{ left: "60%", bottom: "-3%", width: 3, height: 6, animationDuration: "16s", animationDelay: "-15s", opacity: 0.4 }} />
<span className="p" style={{ left: "39%", bottom: "-2%", width: 4, height: 3, animationDuration: "14s", animationDelay: "-8s", opacity: 0.4 }} />
<span className="p" style={{ left: "88%", bottom: "-5%", width: 3, height: 4, animationDuration: "17s", animationDelay: "-11s", opacity: 0.22 }} />
<span className="p" style={{ left: "88%", bottom: "-17%", width: 3, height: 5, animationDuration: "10s", animationDelay: "-8s", opacity: 0.3 }} />
<span className="p" style={{ left: "21%", bottom: "-11%", width: 4, height: 5, animationDuration: "12s", animationDelay: "-6s", opacity: 0.22 }} />
<span className="p" style={{ left: "51%", bottom: "-23%", width: 4, height: 4, animationDuration: "17s", animationDelay: "-15s", opacity: 0.3 }} />
<span className="p" style={{ left: "93%", bottom: "-0%", width: 3, height: 5, animationDuration: "16s", animationDelay: "-8s", opacity: 0.22 }} />
<span className="p" style={{ left: "88%", bottom: "-19%", width: 5, height: 6, animationDuration: "14s", animationDelay: "-11s", opacity: 0.15 }} />
<span className="p" style={{ left: "28%", bottom: "-3%", width: 4, height: 6, animationDuration: "12s", animationDelay: "-10s", opacity: 0.22 }} />
<span className="p" style={{ left: "61%", bottom: "-19%", width: 3, height: 6, animationDuration: "14s", animationDelay: "-2s", opacity: 0.15 }} />
<span className="p" style={{ left: "49%", bottom: "-25%", width: 4, height: 6, animationDuration: "11s", animationDelay: "-13s", opacity: 0.3 }} />
<span className="p" style={{ left: "11%", bottom: "-25%", width: 6, height: 6, animationDuration: "15s", animationDelay: "-2s", opacity: 0.22 }} />
<span className="p" style={{ left: "21%", bottom: "-4%", width: 3, height: 4, animationDuration: "18s", animationDelay: "-14s", opacity: 0.22 }} />

      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-[2vw] pt-[1.2vh] pb-[1vh] flex-wrap">
        <div className="hidden md:block text-[clamp(10px,0.8vw,14px)] tracking-[0.25em] uppercase leading-relaxed" style={{ color: "#E6C35C" }}>
          <div>One Community · One Passion</div>
          <div>One League · One Family</div>
        </div>
        <div className="flex items-center gap-3 mx-auto">
          <img src="/logo.png" alt="" onError={(e: any) => { e.currentTarget.style.display = "none"; }}
            className="w-[clamp(44px,4.2vw,80px)] h-[clamp(44px,4.2vw,80px)] rounded-full border-2 object-cover"
            style={{ borderColor: "#D4AF37", boxShadow: "0 0 24px rgba(212,175,55,0.45)" }} />
          <div className="text-center">
            <div className="font-display font-black leading-none text-[clamp(26px,3.2vw,60px)]" style={GOLD_TEXT}>MTCC</div>
            <div className="font-display font-bold uppercase tracking-wider text-[clamp(10px,0.95vw,17px)]">
              {settings?.tournament_name || "Maharashtra Tennis Cricket Championship U.A.E."}
            </div>
            <div className="inline-block mt-1 px-3 py-0.5 rounded-full text-[clamp(9px,0.75vw,13px)] font-bold tracking-[0.25em] uppercase"
              style={{ background: "linear-gradient(90deg,#8C6A1C,#E8C25A,#8C6A1C)", color: "#0A0F1C" }}>
              {settings?.season || "Season 1"} · Player Auction
            </div>
          </div>
        </div>
        <div className="text-right text-[clamp(10px,0.8vw,14px)] uppercase tracking-[0.2em]" style={{ color: "#E6C35C" }}>
          <div className="flex items-center justify-end gap-2 font-bold text-white">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#FF3B4E", boxShadow: "0 0 10px #FF3B4E" }} />
            Live · Auction Day
          </div>
          {dateText && <div>{dateText}</div>}
          <div>{settings?.auction_venue || settings?.country || "Dubai, U.A.E."}</div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 grid gap-[1vw] px-[1.4vw] pb-[1vh] grid-cols-1 lg:grid-cols-[28fr_40fr_32fr]">

        {/* LEFT — PLAYER */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden" style={PANEL}>
          <GoldCorners />
          <PanelTitle icon="👤">Player Profile</PanelTitle>
          {!player ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-[#8B98B5]">
              {auction?.current_player_id ? "Loading player…" : "Next player coming up…"}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-[1vw] gap-[1vh]">
              <div className="flex gap-[1vw] min-h-0">
                <div className="relative shrink-0 w-[42%] aspect-[3/4] rounded-xl overflow-hidden" style={{ border: "1px solid rgba(212,175,55,0.6)" }}>
                  {photoUrl(player.photo_path)
                    ? <img src={photoUrl(player.photo_path) as string} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[5vw] font-black" style={{ ...GOLD_TEXT, background: "#101a31" }}>{(player.full_name || "?").slice(0, 1)}</div>}
                  <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(0deg, rgba(4,7,15,0.85), transparent)" }} />
                  <div className="absolute bottom-1.5 left-2 text-[clamp(9px,0.7vw,12px)] font-bold tracking-widest" style={{ color: "#F0C94A" }}>
                    LOT #{Number(auction?.pool_index || 0) + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-black uppercase leading-tight text-[clamp(18px,1.7vw,34px)]" style={GOLD_TEXT}>{player.full_name}</div>
                  <div className="text-[clamp(10px,0.75vw,13px)] font-mono mt-0.5 text-[#8B98B5]">
                    ID {player.player_code || "—"}{age != null ? ` · ${age} yrs` : ""}
                  </div>
                  <div className="mt-[1vh]">
                    {[
                      ["🏏", "Role", player.playing_role],
                      ["🎯", "Batting", player.batting_style],
                      ["⚾", "Bowling", player.bowling_style],
                      ["💰", "Base Price", `${fmt(basePrice)} pts`],
                      ["📍", "From", player.district || player.state],
                    ].map(([icon, label, value]) => (
                      <div key={label as string} className="flex items-center justify-between gap-2 py-[0.55vh] border-b text-[clamp(11px,0.85vw,16px)]" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                        <span className="text-[#9AA6C2] whitespace-nowrap"><span className="mr-1.5">{icon}</span>{label}</span>
                        <span className="font-semibold text-right leading-tight">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {(player.cricheroes_matches || player.cricheroes_runs || player.cricheroes_wickets) && (
                <div className="rounded-xl overflow-hidden mt-auto" style={{ border: "1px solid rgba(212,175,55,0.35)" }}>
                  <div className="text-center text-[clamp(9px,0.7vw,12px)] font-bold uppercase tracking-[0.25em] py-1" style={{ background: "rgba(212,175,55,0.12)", color: "#F0C94A" }}>Career Stats</div>
                  <div className="grid grid-cols-3">
                    {[["Matches", player.cricheroes_matches], ["Runs", player.cricheroes_runs], ["Wickets", player.cricheroes_wickets]].map(([label, value], i) => (
                      <div key={label as string} className={`py-[0.9vh] text-center ${i ? "border-l" : ""}`} style={{ borderColor: "rgba(212,175,55,0.2)" }}>
                        <div className="font-display font-black text-[clamp(16px,1.5vw,30px)]" style={GOLD_TEXT}>{value ?? "—"}</div>
                        <div className="text-[clamp(8px,0.65vw,11px)] uppercase tracking-wider text-[#9AA6C2]">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CENTRE — BIDDING */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden order-first lg:order-none" style={{ ...PANEL, border: "1.5px solid rgba(212,175,55,0.8)" }}>
          <GoldCorners />
          <div className="text-center pt-[1.2vh] pb-[0.6vh] border-b" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[clamp(20px,2vw,40px)]">🔨</span>
              <span className="font-display font-black uppercase tracking-wide text-[clamp(22px,2.5vw,50px)]" style={GOLD_TEXT}>Live Player Auction</span>
              <span className="text-[clamp(20px,2vw,40px)] -scale-x-100 inline-block">🔨</span>
            </div>
            <div className="text-[clamp(10px,0.85vw,15px)] uppercase tracking-[0.2em] text-[#C7CEDD]">
              {isUnsoldRound ? "Unsold Round" : "Main List"}
              {auction?.current_player_id ? ` · Player ${Number(auction.pool_index || 0) + 1} of ${pool.length}` : ""}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-[1.2vh] p-[1vw]">
            {banner ? (
              <div className="flex-1 rounded-2xl flex flex-col items-center justify-center text-center p-6"
                style={{
                  background: banner.type === "SOLD" ? "radial-gradient(circle, rgba(61,220,151,0.22), rgba(8,13,26,0.2))" : "radial-gradient(circle, rgba(255,93,108,0.2), rgba(8,13,26,0.2))",
                  border: `2px solid ${banner.type === "SOLD" ? "#3DDC97" : "#FF5D6C"}`,
                }}>
                <div className="font-display font-black tracking-[0.1em] text-[clamp(36px,5vw,100px)]"
                  style={{ color: banner.type === "SOLD" ? "#3DDC97" : "#FF5D6C", textShadow: `0 0 40px ${banner.type === "SOLD" ? "rgba(61,220,151,0.6)" : "rgba(255,93,108,0.6)"}` }}>
                  {banner.type === "SOLD" ? "SOLD!" : "UNSOLD"}
                </div>
                <div className="font-display font-bold text-[clamp(18px,1.8vw,36px)] mt-1">{banner.playerName || "Player"}</div>
                {banner.type === "SOLD" && (
                  <div className="mt-[2vh] flex items-center gap-4">
                    {(() => {
                      const t = teamStats.find((x: any) => x.id === banner.teamId) || teamStats.find((x: any) => x.name === banner.teamName);
                      const l = t ? logoUrl(t.logo_path) : null;
                      return l ? <img src={l} alt="" className="w-[clamp(56px,5vw,100px)] h-[clamp(56px,5vw,100px)] object-contain rounded-xl bg-white/5 p-1" /> : null;
                    })()}
                    <div className="text-left">
                      <div className="text-[clamp(10px,0.8vw,14px)] uppercase tracking-[0.3em] text-[#9AA6C2]">Sold To</div>
                      <div className="font-display font-black uppercase text-[clamp(18px,1.9vw,38px)]">{banner.teamName || "—"}</div>
                      <div className="font-display font-black text-[clamp(22px,2.4vw,48px)]" style={GOLD_TEXT}>{fmt(banner.amount)} PTS</div>
                    </div>
                  </div>
                )}
              </div>
            ) : !auction?.current_player_id ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="font-display font-black text-[clamp(28px,3vw,60px)]" style={GOLD_TEXT}>
                  {!pool.length ? "Auction Starting Soon" : isUnsoldRound ? "Unsold Round Complete" : "Main List Complete"}
                </div>
                <div className="text-[clamp(12px,1vw,18px)] mt-2 text-[#C7CEDD]">
                  {!pool.length ? "Stay tuned. The first player will be on the block shortly."
                    : queueCount > 0 ? `${queueCount} player${queueCount === 1 ? "" : "s"} in the Unsold Queue. The Unsold Round starts shortly.`
                    : "Every player has been auctioned. Thank you for watching!"}
                </div>
              </div>
            ) : (
              <>
                <div className="text-center font-display font-black uppercase text-[clamp(16px,1.6vw,32px)] tracking-wide">{player?.full_name || " "}</div>

                <div className="rounded-2xl text-center py-[1.4vh] px-4"
                  style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18), rgba(8,13,26,0.6) 70%)", border: "1px solid rgba(212,175,55,0.7)" }}>
                  <div className="text-[clamp(11px,0.95vw,18px)] font-bold uppercase tracking-[0.35em]" style={{ color: "#E6C35C" }}>Current Bid</div>
                  <div className="font-display font-black leading-none my-[0.6vh] text-[clamp(56px,7.2vw,150px)] tabular-nums" style={GOLD_TEXT}>
                    {fmt(currentBid)}<span className="text-[0.32em] ml-2 align-baseline">PTS</span>
                  </div>
                  <div className="flex justify-center gap-6 text-[clamp(10px,0.85vw,15px)] text-[#C7CEDD]">
                    <span>Base <b className="text-white">{fmt(basePrice)}</b></span>
                    <span>Next +<b className="text-white">{fmt(increment)}</b></span>
                    <span>Bids <b className="text-white">{bidHistory.length}</b></span>
                  </div>
                </div>

                <div className="rounded-2xl flex items-center gap-[1.2vw] px-[1.4vw] py-[1.4vh]"
                  style={leading
                    ? { background: "linear-gradient(135deg, rgba(61,220,151,0.18), rgba(8,13,26,0.7))", border: "2px solid #3DDC97", boxShadow: "0 0 30px rgba(61,220,151,0.3)" }
                    : { background: "rgba(8,13,26,0.7)", border: "1px solid rgba(212,175,55,0.45)" }}>
                  {leading ? (
                    <>
                      {logoUrl(leading.logo_path)
                        ? <img src={logoUrl(leading.logo_path) as string} alt="" className="w-[clamp(56px,5.4vw,108px)] h-[clamp(56px,5.4vw,108px)] object-contain rounded-xl bg-white/5 p-1 shrink-0" />
                        : <div className="w-[clamp(56px,5.4vw,108px)] h-[clamp(56px,5.4vw,108px)] rounded-xl flex items-center justify-center font-black text-2xl shrink-0" style={{ background: "#101a31", color: "#3DDC97" }}>{(leading.name || "").slice(0, 2)}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="text-[clamp(10px,0.85vw,15px)] font-bold uppercase tracking-[0.3em]" style={{ color: "#3DDC97" }}>
                          <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle animate-pulse" style={{ background: "#3DDC97" }} />Currently Bidding
                        </div>
                        <div className="font-display font-black uppercase leading-tight text-[clamp(20px,2.2vw,44px)]" style={{ color: "#5CF0B0" }}>{leading.name}</div>
                      </div>
                      <div className="text-right shrink-0 text-[clamp(10px,0.85vw,15px)] text-[#C7CEDD] leading-relaxed">
                        <div><b className="text-white">{fmt(leading.remaining)}</b> pts left</div>
                        <div><b className="text-white">{leading.squad ?? leading.bought}{(leading.max ?? maxSquad) ? `/${leading.max ?? maxSquad}` : ""}</b> squad</div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full text-center">
                      <div className="text-[clamp(10px,0.85vw,15px)] font-bold uppercase tracking-[0.3em] text-[#C7CEDD]">Bidding Open · Opening Bid</div>
                      <div className="font-display font-black text-[clamp(22px,2.3vw,46px)]" style={GOLD_TEXT}>{fmt(basePrice)} PTS</div>
                      <div className="text-[clamp(10px,0.85vw,15px)] text-[#9AA6C2]">Waiting for the first bid…</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl px-3 py-2 flex-1 min-h-0 overflow-hidden" style={{ background: "rgba(8,13,26,0.55)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <div className="text-[clamp(9px,0.7vw,12px)] font-bold uppercase tracking-[0.3em] text-[#9AA6C2] mb-1">Bid Trail</div>
                  <div className="flex flex-wrap gap-2 overflow-hidden">
                    {[...bidHistory].reverse().slice(0, 12).map((b: any, i: number) => (
                      <span key={`${b.ts}-${i}`} className="px-2.5 py-1 rounded-lg text-[clamp(10px,0.8vw,14px)]"
                        style={{ background: i === 0 ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.04)", color: i === 0 ? "#F0C94A" : "#C7CEDD", fontWeight: i === 0 ? 800 : 500 }}>
                        {b.teamName} · {fmt(b.amount)}
                      </span>
                    ))}
                    {bidHistory.length === 0 && <span className="text-[clamp(10px,0.8vw,14px)] text-[#56607A]">No bids yet</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — TEAMS */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden" style={PANEL}>
          <GoldCorners />
          <PanelTitle icon="🏆">All Teams · Purse &amp; Squad</PanelTitle>
          <div className="grid grid-cols-[2.3fr_1fr_0.55fr_0.55fr] gap-2 px-3 pt-2 pb-1 text-[clamp(8px,0.65vw,12px)] font-bold uppercase tracking-wider text-[#9AA6C2]">
            <span>Team</span><span className="text-right">Purse Left</span><span className="text-center">Bought</span><span className="text-center">Slots</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-[0.5vh]">
            {teamStats.length === 0 && <div className="text-center text-[#56607A] text-sm py-6">Loading teams…</div>}
            {teamStats.map((t: any) => {
              const isLeading = auction?.current_team_id === t.id;
              const inBidding = !!bidTeamIds[t.id];
              const logo = logoUrl(t.logo_path);
              const spentPct = t.total ? Math.min(100, (t.spent / t.total) * 100) : 0;
              const tMax = Number(t.max ?? maxSquad ?? 0); const squadPct = tMax ? Math.min(100, ((t.squad ?? t.bought) / tMax) * 100) : 0;
              return (
                <div key={t.id} className="rounded-xl px-2 py-[0.7vh] transition-all"
                  style={isLeading
                    ? { background: "linear-gradient(90deg, rgba(61,220,151,0.22), rgba(61,220,151,0.05))", border: "1.5px solid #3DDC97" }
                    : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(212,175,55,0.14)" }}>
                  <div className="grid grid-cols-[2.3fr_1fr_0.55fr_0.55fr] gap-2 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-[clamp(24px,2vw,38px)] h-[clamp(24px,2vw,38px)] rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#101a31" }}>
                        {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-0.5" /> : <span className="text-[10px] font-bold" style={{ color: "#F0C94A" }}>{(t.name || "").slice(0, 2)}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold leading-tight text-[clamp(10px,0.82vw,15px)]" style={{ color: isLeading ? "#5CF0B0" : "#FFFFFF" }}>{t.name}</div>
                        <div className="text-[clamp(8px,0.6vw,11px)] font-bold tracking-wider" style={{ color: isLeading ? "#3DDC97" : inBidding ? "#E6C35C" : "#56607A" }}>
                          {isLeading ? "● LEADING" : inBidding ? "● IN THE RACE" : "○ WAITING"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-display font-black tabular-nums text-[clamp(12px,1.05vw,20px)]" style={t.remaining < 0 ? { color: "#FF5D6C" } : GOLD_TEXT}>{fmt(t.remaining)}</div>
                    <div className="text-center font-bold text-[clamp(11px,0.9vw,17px)]">{t.bought}</div>
                    <div className="text-center font-bold text-[clamp(11px,0.9vw,17px)] text-[#C7CEDD]">{t.slots ?? "—"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="h-1 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width: `${spentPct}%`, background: "linear-gradient(90deg,#8C6A1C,#F0C94A)" }} /></div>
                    <div className="h-1 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width: `${squadPct}%`, background: "linear-gradient(90deg,#1E7A5A,#3DDC97)" }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          {leading && (
            <div className="grid grid-cols-3 border-t text-center" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
              {[["Total Purse", leading.total], ["Spent", leading.spent], ["Balance", leading.remaining]].map(([l, v], i) => (
                <div key={l as string} className={`py-[0.8vh] ${i ? "border-l" : ""}`} style={{ borderColor: "rgba(212,175,55,0.2)" }}>
                  <div className="text-[clamp(8px,0.6vw,11px)] uppercase tracking-wider text-[#9AA6C2]">{leading.name} · {l}</div>
                  <div className="font-display font-black text-[clamp(12px,1vw,19px)]" style={GOLD_TEXT}>{fmt(v)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-4 py-1.5 text-[clamp(8px,0.6vw,11px)] text-[#9AA6C2]">
            <span><span className="inline-block w-3 h-1 rounded mr-1 align-middle" style={{ background: "#F0C94A" }} />Purse spent</span>
            <span><span className="inline-block w-3 h-1 rounded mr-1 align-middle" style={{ background: "#3DDC97" }} />Squad filled</span>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 px-[1.4vw] pb-[1vh]">
        <div className="rounded-2xl grid grid-cols-2 md:grid-cols-[1.4fr_repeat(5,1fr)_1.6fr] items-stretch overflow-hidden" style={PANEL}>
          <div className="flex items-center gap-3 px-4 py-[1vh] col-span-2 md:col-span-1 border-b md:border-b-0 md:border-r" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
            <span className="text-[clamp(10px,0.75vw,13px)] font-bold uppercase tracking-[0.2em] text-[#9AA6C2] shrink-0">Next Up</span>
            {nextPlayer ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[clamp(30px,2.4vw,44px)] h-[clamp(30px,2.4vw,44px)] rounded-full overflow-hidden shrink-0" style={{ border: "1px solid #D4AF37" }}>
                  {photoUrl(nextPlayer.photo_path)
                    ? <img src={photoUrl(nextPlayer.photo_path) as string} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ background: "#101a31", color: "#F0C94A" }}>{(nextPlayer.full_name || "?").slice(0, 1)}</div>}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate text-[clamp(11px,0.9vw,16px)]">{nextPlayer.full_name}</div>
                  <div className="text-[clamp(9px,0.7vw,12px)] text-[#9AA6C2] truncate">{nextPlayer.playing_role || "—"}</div>
                </div>
              </div>
            ) : <span className="text-[clamp(10px,0.8vw,14px)] text-[#56607A]">{remainingInRound > 1 ? "Loading…" : "Last player of this list"}</span>}
          </div>
          {[
            ["Teams", teamStats.length],
            ["Players", pool.length],
            ["Sold", soldInRound],
            ["Remaining", remainingInRound],
            [isUnsoldRound ? "Round" : "Unsold Queue", isUnsoldRound ? "Unsold" : queueCount],
          ].map(([l, v]) => (
            <div key={l as string} className="text-center py-[1vh] border-r" style={{ borderColor: "rgba(212,175,55,0.2)" }}>
              <div className="text-[clamp(8px,0.65vw,12px)] uppercase tracking-wider text-[#9AA6C2]">{l}</div>
              <div className="font-display font-black text-[clamp(16px,1.6vw,30px)]" style={GOLD_TEXT}>{v}</div>
            </div>
          ))}
          <div className="text-center py-[1vh] px-3 col-span-2 md:col-span-1">
            <div className="text-[clamp(8px,0.65vw,12px)] uppercase tracking-wider text-[#9AA6C2]">Last Sold</div>
            {lastSold ? (
              <div className="text-[clamp(10px,0.85vw,15px)] font-bold truncate">
                {lastSold.playerName} → {lastSold.teamName} · <span style={{ color: "#F0C94A" }}>{fmt(lastSold.amount)}</span>
              </div>
            ) : <div className="text-[clamp(10px,0.85vw,15px)] text-[#56607A]">—</div>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-[0.8vh] text-[clamp(9px,0.72vw,13px)] tracking-[0.2em] uppercase">
          <span className="text-[#9AA6C2]">Organised by <b style={{ color: "#E6C35C" }}>MTCC U.A.E. Organising Committee</b></span>
          <span className="font-display italic normal-case tracking-normal text-[clamp(12px,1.05vw,20px)]" style={GOLD_TEXT}>More Than a Tournament. It&rsquo;s a Family.</span>
          <span className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#FF0033", color: "#fff" }}>▶ Live on YouTube</span>
            <span className="px-2 py-0.5 rounded font-bold" style={{ background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", color: "#fff" }}>● Live on Instagram</span>
          </span>
        </div>
      </footer>

      <style>{`
        .p { position:absolute; border-radius:50%; background:#F0C94A; filter:blur(1px);
             animation-name:riseUp; animation-timing-function:linear; animation-iteration-count:infinite; pointer-events:none; }
        @keyframes riseUp { from { transform:translateY(0) } to { transform:translateY(-2200px) } }
      `}</style>
    </div>
  );
}
