"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeAge } from "@/lib/constants";

// MTCC live auction broadcast screen (Display Mode).
// Public and read-only: it only reads auction_state, player_public and
// team_public, which never include Emirates ID, contact or payment data.
// Built for a 16:9 LED screen at the venue; it stacks neatly on phones for
// the online audience. Every value is live, so the same screen works for
// every player with nothing to edit by hand.

const GOLD_TEXT: any = {
  background: "linear-gradient(180deg, #FFF3C4 0%, #F4CF5B 38%, #C9962A 72%, #F0C94A 100%)",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
};
const PANEL: any = {
  background: "linear-gradient(180deg, rgba(17,27,50,0.94) 0%, rgba(8,13,26,0.96) 100%)",
  border: "1px solid rgba(212,175,55,0.55)",
  boxShadow: "inset 0 1px 0 rgba(255,236,170,0.12), 0 12px 40px rgba(0,0,0,0.55), 0 0 30px rgba(212,175,55,0.07)",
};

function nextIncrement(currentBid: number, s: any) {
  if (!currentBid) return s?.auction_starting_bid ?? 2000;
  if (currentBid >= (s?.auction_tier4_threshold ?? 20000)) return s?.auction_tier4_increment ?? 5000;
  if (currentBid >= (s?.auction_tier3_threshold ?? 15000)) return s?.auction_tier3_increment ?? 3000;
  if (currentBid >= (s?.auction_tier2_threshold ?? 10000)) return s?.auction_tier2_increment ?? 2000;
  return s?.auction_bid_increment ?? 1000;
}
const fmt = (n: any) => Number(n || 0).toLocaleString("en-US");

// --- small decorative pieces ------------------------------------------------
function Skyline() {
  // Simplified Dubai skyline silhouette (Burj Khalifa in the centre-left).
  const b: [number, number, number][] = [
    [0, 60, 40], [45, 90, 30], [80, 70, 26], [110, 120, 22], [136, 80, 34], [175, 140, 20], [200, 95, 30], [236, 160, 18],
    [260, 110, 28], [292, 75, 34], [330, 130, 24], [360, 90, 30], [640, 100, 30], [676, 150, 22], [704, 85, 34], [744, 125, 26],
    [776, 170, 18], [800, 95, 32], [838, 140, 24], [868, 80, 36], [910, 115, 26], [942, 70, 40], [988, 100, 30], [1024, 60, 40],
    [1070, 130, 22], [1098, 85, 34], [1138, 105, 28], [1172, 65, 40], [1218, 90, 30], [1254, 55, 46],
  ];
  return (
    <svg viewBox="0 0 1300 330" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 w-full h-[55%] opacity-[0.22] pointer-events-none">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0A0F1C" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g fill="url(#sky)">
        {b.map(([x, h, w], i) => <rect key={i} x={x} y={330 - h} width={w} height={h} />)}
        {/* Burj Khalifa */}
        <polygon points="470,330 470,190 480,190 482,120 490,120 493,40 497,0 501,40 504,120 512,120 514,190 524,190 524,330" />
        <polygon points="420,330 420,210 438,200 456,210 456,330" />
        {/* Burj Al Arab sail */}
        <path d="M560 330 L560 150 Q610 175 606 330 Z" />
      </g>
    </svg>
  );
}

function PanelTitle({ icon, children, right }: { icon: string; children: any; right?: any }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="font-display font-black uppercase tracking-wide text-[clamp(13px,1.05vw,20px)]" style={GOLD_TEXT}>{children}</span>
      </div>
      {right}
    </div>
  );
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

// --- page -------------------------------------------------------------------
export default function AuctionDisplayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [auction, setAuction] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<any[]>([]);
  const [poolStatus, setPoolStatus] = useState<Record<string, string>>({});
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [banner, setBanner] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const lastResultTs = useRef<number | null>(null);
  const bannerTimer = useRef<any>(null);
  const requested = useRef<Set<string>>(new Set());
  const auctionRef = useRef<any>(null);

  function ensurePlayer(id: string | null) {
    if (!id || requested.current.has(id)) return;
    requested.current.add(id);
    supabase.from("player_public").select("*").eq("id", id).single().then(({ data }: any) => {
      if (data) setPlayers((p) => ({ ...p, [id]: data }));
      else requested.current.delete(id);
    });
  }

  async function loadCounts() {
    const pool: string[] = auctionRef.current?.pool_order || [];
    const [{ data: t }, { data: sold }, { count }, { data: poolRows }] = await Promise.all([
      supabase.from("team_public").select("*"),
      supabase.from("player_public").select("id, team_id, sold_points").eq("application_status", "Sold / Selected"),
      supabase.from("player_public").select("id", { count: "exact", head: true }).eq("application_status", "Unsold / Not Selected"),
      pool.length ? supabase.from("player_public").select("id, application_status").in("id", pool) : Promise.resolve({ data: [] as any[] }),
    ]);
    setTeams(t ?? []);
    setSquadPlayers(sold ?? []);
    setUnsoldCount(count ?? 0);
    const map: Record<string, string> = {};
    for (const r of poolRows ?? []) map[r.id] = r.application_status;
    setPoolStatus(map);
  }

  function onAuction(next: any) {
    if (!next) return;
    auctionRef.current = next;
    setAuction(next);
    ensurePlayer(next.current_player_id ?? null);
    const upcoming = next.pool_order?.[Number(next.pool_index ?? 0) + 1];
    if (upcoming) ensurePlayer(upcoming);

    const ts = next.last_action?.ts ?? null;
    if (ts !== lastResultTs.current) {
      const first = lastResultTs.current === null;
      lastResultTs.current = ts;
      loadCounts();
      if (!first && next.last_action) {
        setBanner(next.last_action);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 6000);
      }
    }
  }

  useEffect(() => {
    supabase.from("tournament_settings").select("*").eq("id", 1).single().then(({ data }: any) => setSettings(data));
    supabase.from("auction_state").select("*").eq("id", 1).single().then(({ data }: any) => { onAuction(data); loadCounts(); });

    const channel = supabase
      .channel("auction-display")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state", filter: "id=eq.1" }, (payload: any) => onAuction(payload.new))
      .subscribe();
    const poll = setInterval(() => {
      supabase.from("auction_state").select("*").eq("id", 1).single().then(({ data }: any) => onAuction(data));
    }, 15000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { supabase.removeChannel(channel); clearInterval(poll); clearInterval(tick); clearTimeout(bannerTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- derived values -------------------------------------------------------
  const photoUrl = (path: string | null) => (path ? supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl : null);
  const logoUrl = (path: string | null) => (path ? supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl : null);

  const player = auction?.current_player_id ? players[auction.current_player_id] : null;
  const nextPlayerId = auction?.pool_order?.[Number(auction?.pool_index ?? 0) + 1];
  const nextPlayer = nextPlayerId ? players[nextPlayerId] : null;
  const maxSquad = Number(settings?.max_squad_size || 0);

  const teamStats = teams.map((t: any) => {
    const squad = squadPlayers.filter((p: any) => p.team_id === t.id);
    const spent = squad.reduce((s: number, p: any) => s + Number(p.sold_points || 0), 0);
    const total = Number(t.auction_points || 0);
    return { ...t, total, spent, remaining: total - spent, bought: squad.length, slots: maxSquad ? Math.max(0, maxSquad - squad.length) : null };
  });
  const leading = teamStats.find((t: any) => t.id === auction?.current_team_id) || null;
  const bidTeamIds = new Set((auction?.bid_history || []).map((b: any) => b.teamId));

  const currentBid = Number(auction?.current_bid || 0);
  const basePrice = settings?.auction_starting_bid ?? 2000;
  const increment = nextIncrement(currentBid, settings);
  const age = player ? computeAge(player.dob) : null;

  const secondsLeft = auction?.timer_ends_at ? Math.max(0, Math.ceil((new Date(auction.timer_ends_at).getTime() - now) / 1000)) : null;
  const isUnsoldRound = auction?.round === "Unsold";

  const status: { label: string; color: string } =
    banner ? (banner.type === "SOLD" ? { label: "SOLD", color: "#3DDC97" } : { label: "UNSOLD", color: "#FF5D6C" })
    : auction?.status === "paused" ? { label: "PAUSED", color: "#FF9A66" }
    : auction?.call_status === "Going Twice" ? { label: "GOING TWICE", color: "#FF6B3D" }
    : auction?.call_status === "Going Once" ? { label: "GOING ONCE", color: "#FFB547" }
    : auction?.current_player_id ? { label: "OPEN", color: "#3DDC97" }
    : { label: "STANDBY", color: "#8B98B5" };

  const pool: string[] = auction?.pool_order || [];
  const soldInRound = pool.filter((id) => poolStatus[id] === "Sold / Selected").length;
  const unsoldInRound = pool.filter((id) => poolStatus[id] === "Unsold / Not Selected").length;
  const remainingInRound = auction?.current_player_id ? pool.length - Number(auction.pool_index || 0) : 0;
  const lastSold = auction?.last_action?.type === "SOLD" ? auction.last_action : null;

  const dateText = settings?.auction_date ? new Date(settings.auction_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  // --- render ---------------------------------------------------------------
  return (
    <div className="relative min-h-screen lg:h-screen overflow-hidden text-white flex flex-col"
      style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, #1B2A4D 0%, #0B1224 45%, #04070F 100%)" }}>
      {/* stadium floodlights + skyline */}
      <div className="absolute -top-24 -left-24 w-[40vw] h-[40vw] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,240,200,0.22) 0%, rgba(255,240,200,0) 60%)" }} />
      <div className="absolute -top-24 -right-24 w-[40vw] h-[40vw] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,240,200,0.22) 0%, rgba(255,240,200,0) 60%)" }} />
      <Skyline />

      {/* TOP HEADER */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-[2vw] pt-[1.2vh] pb-[1vh] flex-wrap">
        <div className="hidden md:block text-[clamp(10px,0.8vw,14px)] tracking-[0.25em] uppercase leading-relaxed" style={{ color: "#E6C35C" }}>
          <div>One Community · One Passion</div>
          <div>One League · One Family</div>
        </div>
        <div className="flex items-center gap-3 mx-auto">
          <img src="/logo.png" alt="MTCC" className="w-[clamp(44px,4.2vw,80px)] h-[clamp(44px,4.2vw,80px)] rounded-full border-2 object-cover" style={{ borderColor: "#D4AF37", boxShadow: "0 0 24px rgba(212,175,55,0.45)" }} />
          <div className="text-center">
            <div className="font-display font-black leading-none text-[clamp(26px,3.2vw,60px)]" style={GOLD_TEXT}>MTCC</div>
            <div className="font-display font-bold uppercase tracking-wider text-[clamp(10px,0.95vw,17px)]">{settings?.tournament_name || "Maharashtra Tennis Cricket Championship U.A.E."}</div>
            <div className="inline-block mt-1 px-3 py-0.5 rounded-full text-[clamp(9px,0.75vw,13px)] font-bold tracking-[0.25em] uppercase" style={{ background: "linear-gradient(90deg,#8C6A1C,#E8C25A,#8C6A1C)", color: "#0A0F1C" }}>
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

      {/* MAIN: 3 zones */}
      <main className="relative z-10 flex-1 min-h-0 grid gap-[1vw] px-[1.4vw] pb-[1vh] grid-cols-1 lg:grid-cols-[28fr_40fr_32fr]">

        {/* LEFT – PLAYER PROFILE */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden" style={PANEL}>
          <GoldCorners />
          <PanelTitle icon="👤" right={player?.auction_category ? (
            <span className="px-2.5 py-1 rounded-full text-[clamp(9px,0.7vw,12px)] font-bold uppercase tracking-wider" style={{ background: "linear-gradient(90deg,#8C6A1C,#E8C25A)", color: "#0A0F1C" }}>★ Featured Player</span>
          ) : null}>Player Profile</PanelTitle>

          {!player ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-[#8B98B5]">
              {auction?.current_player_id ? "Loading player…" : "Next player coming up…"}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-[1vw] gap-[1vh]">
              <div className="flex gap-[1vw] min-h-0">
                <div className="relative shrink-0 w-[42%] aspect-[3/4] rounded-xl overflow-hidden" style={{ border: "1px solid rgba(212,175,55,0.6)", boxShadow: "0 0 30px rgba(212,175,55,0.2)" }}>
                  {photoUrl(player.photo_path)
                    ? <img src={photoUrl(player.photo_path)!} alt={player.full_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[5vw] font-black" style={{ ...GOLD_TEXT, background: "#101a31" }}>{(player.full_name || "?").slice(0, 1)}</div>}
                  <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(0deg, rgba(4,7,15,0.85), transparent)" }} />
                  <div className="absolute bottom-1.5 left-2 text-[clamp(9px,0.7vw,12px)] font-bold tracking-widest" style={{ color: "#F0C94A" }}>LOT #{Number(auction.pool_index || 0) + 1}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-black uppercase leading-tight text-[clamp(18px,1.7vw,34px)]" style={GOLD_TEXT}>{player.full_name}</div>
                  <div className="text-[clamp(10px,0.75vw,13px)] font-mono mt-0.5 text-[#8B98B5]">ID {player.player_code || "—"}{age != null ? ` · ${age} yrs` : ""}</div>
                  <div className="mt-[1vh] divide-y" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                    {[
                      ["🏏", "Role", player.playing_role],
                      ["🎯", "Batting", player.batting_style],
                      ["⚾", "Bowling", player.bowling_style],
                      ["🏅", "Category", player.auction_category || "Unassigned"],
                      ["💰", "Base Price", `${fmt(basePrice)} pts`],
                      ["📍", "From", player.district || player.state],
                      ...(player.previous_team || player.club_name ? [["🛡️", "Prev. Team", player.previous_team || player.club_name]] : []),
                    ].map(([icon, label, value]) => (
                      <div key={label as string} className="flex items-center justify-between gap-2 py-[0.55vh] text-[clamp(11px,0.85vw,16px)]" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                        <span className="text-[#9AA6C2] whitespace-nowrap"><span className="mr-1.5">{icon}</span>{label}</span>
                        <span className="font-semibold text-right leading-tight">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(player.cricheroes_matches || player.cricheroes_runs || player.cricheroes_wickets) && (
                <div className="rounded-xl overflow-hidden mt-auto" style={{ border: "1px solid rgba(212,175,55,0.35)" }}>
                  <div className="text-center text-[clamp(9px,0.7vw,12px)] font-bold uppercase tracking-[0.25em] py-1" style={{ background: "rgba(212,175,55,0.12)", color: "#F0C94A" }}>Career Stats · CricHeroes</div>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${[player.cricheroes_matches, player.cricheroes_runs, player.cricheroes_wickets, player.cricheroes_strike_rate, player.cricheroes_economy].filter((v) => v !== null && v !== undefined).length || 3}, minmax(0,1fr))` }}>
                    {[
                      ["Matches", player.cricheroes_matches], ["Runs", player.cricheroes_runs], ["Wickets", player.cricheroes_wickets],
                      ["Strike Rate", player.cricheroes_strike_rate], ["Economy", player.cricheroes_economy],
                    ].filter(([, v]) => v !== null && v !== undefined).map(([label, value], i) => (
                      <div key={label as string} className={`py-[0.9vh] text-center ${i ? "border-l" : ""}`} style={{ borderColor: "rgba(212,175,55,0.2)" }}>
                        <div className="font-display font-black text-[clamp(16px,1.5vw,30px)]" style={GOLD_TEXT}>{value}</div>
                        <div className="text-[clamp(8px,0.65vw,11px)] uppercase tracking-wider text-[#9AA6C2]">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CENTRE – LIVE BIDDING */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden order-first lg:order-none" style={{ ...PANEL, border: "1.5px solid rgba(212,175,55,0.8)" }}>
          <GoldCorners />
          <div className="text-center pt-[1.2vh] pb-[0.6vh] border-b" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[clamp(20px,2vw,40px)]">🔨</span>
              <span className="font-display font-black uppercase tracking-wide text-[clamp(22px,2.5vw,50px)]" style={GOLD_TEXT}>Live Player Auction</span>
              <span className="text-[clamp(20px,2vw,40px)] -scale-x-100 inline-block">🔨</span>
            </div>
            <div className="text-[clamp(10px,0.85vw,15px)] uppercase tracking-[0.2em] text-[#C7CEDD]">
              {isUnsoldRound ? "Unsold Round" : "Main List"}{auction?.current_player_id ? ` · Player ${Number(auction.pool_index || 0) + 1} of ${pool.length}` : ""}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-[1.2vh] p-[1vw]">
            {banner ? (
              /* SOLD TO / UNSOLD takeover */
              <div className="flex-1 rounded-2xl flex flex-col items-center justify-center text-center p-6"
                style={{ background: banner.type === "SOLD" ? "radial-gradient(circle, rgba(61,220,151,0.22), rgba(8,13,26,0.2))" : "radial-gradient(circle, rgba(255,93,108,0.2), rgba(8,13,26,0.2))", border: `2px solid ${banner.type === "SOLD" ? "#3DDC97" : "#FF5D6C"}` }}>
                <div className="font-display font-black tracking-[0.1em] text-[clamp(36px,5vw,100px)]" style={{ color: banner.type === "SOLD" ? "#3DDC97" : "#FF5D6C", textShadow: `0 0 40px ${banner.type === "SOLD" ? "rgba(61,220,151,0.6)" : "rgba(255,93,108,0.6)"}` }}>
                  {banner.type === "SOLD" ? "SOLD!" : "UNSOLD"}
                </div>
                <div className="font-display font-bold text-[clamp(18px,1.8vw,36px)] mt-1">{banner.playerName}</div>
                {banner.type === "SOLD" ? (() => {
                  const t = teamStats.find((x: any) => x.name === banner.teamName);
                  return (
                    <div className="mt-[2vh] flex items-center gap-4">
                      {t && logoUrl(t.logo_path) && <img src={logoUrl(t.logo_path)!} alt="" className="w-[clamp(56px,5vw,100px)] h-[clamp(56px,5vw,100px)] object-contain rounded-xl bg-white/5 p-1" />}
                      <div className="text-left">
                        <div className="text-[clamp(10px,0.8vw,14px)] uppercase tracking-[0.3em] text-[#9AA6C2]">Sold To</div>
                        <div className="font-display font-black uppercase text-[clamp(18px,1.9vw,38px)]">{banner.teamName}</div>
                        <div className="font-display font-black text-[clamp(22px,2.4vw,48px)]" style={GOLD_TEXT}>{fmt(banner.amount)} PTS</div>
                      </div>
                    </div>
                  );
                })() : <div className="text-[clamp(12px,1vw,18px)] mt-2 text-[#9AA6C2]">Moves to the Unsold Queue for the Unsold Round</div>}
              </div>
            ) : !auction?.current_player_id ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="font-display font-black text-[clamp(28px,3vw,60px)]" style={GOLD_TEXT}>
                  {!pool.length ? "Auction Starting Soon" : isUnsoldRound ? "Unsold Round Complete" : "Main List Complete"}
                </div>
                <div className="text-[clamp(12px,1vw,18px)] mt-2 text-[#C7CEDD]">
                  {!pool.length ? "Stay tuned. The first player will be on the block shortly."
                    : unsoldCount > 0 ? `${unsoldCount} player${unsoldCount === 1 ? "" : "s"} in the Unsold Queue. The Unsold Round starts shortly.`
                    : "Every player has been auctioned. Thank you for watching!"}
                </div>
              </div>
            ) : (
              <>
                <div className="text-center font-display font-black uppercase text-[clamp(16px,1.6vw,32px)] tracking-wide">{player?.full_name || " "}</div>

                {/* CURRENT BID */}
                <div className="relative rounded-2xl text-center py-[1.4vh] px-4" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18), rgba(8,13,26,0.6) 70%)", border: "1px solid rgba(212,175,55,0.7)", boxShadow: "0 0 40px rgba(212,175,55,0.18)" }}>
                  <div className="text-[clamp(11px,0.95vw,18px)] font-bold uppercase tracking-[0.35em]" style={{ color: "#E6C35C" }}>Current Bid</div>
                  <div className="font-display font-black leading-none my-[0.6vh] text-[clamp(56px,7.2vw,150px)] tabular-nums" style={{ ...GOLD_TEXT, filter: "drop-shadow(0 4px 18px rgba(212,175,55,0.35))" }}>
                    {fmt(currentBid)}<span className="text-[0.32em] ml-2 align-baseline">PTS</span>
                  </div>
                  <div className="flex justify-center gap-6 text-[clamp(10px,0.85vw,15px)] text-[#C7CEDD]">
                    <span>Base <b className="text-white">{fmt(basePrice)}</b></span>
                    <span>Next +<b className="text-white">{fmt(increment)}</b></span>
                    <span>Bids <b className="text-white">{(auction.bid_history || []).length}</b></span>
                  </div>
                </div>

                {/* timer + currently bidding */}
                <div className="grid grid-cols-5 gap-[0.8vw]">
                  <div className="col-span-2 rounded-2xl flex flex-col items-center justify-center py-[1vh]" style={{ background: "rgba(8,13,26,0.7)", border: "1px solid rgba(212,175,55,0.45)" }}>
                    <div className="text-[clamp(10px,0.8vw,14px)] font-bold uppercase tracking-[0.3em] text-[#C7CEDD]">⏱ Time Left</div>
                    <div className="font-display font-black tabular-nums text-[clamp(30px,3.4vw,68px)] leading-tight"
                      style={secondsLeft !== null && secondsLeft <= 5 ? { color: "#FF5D6C", textShadow: "0 0 20px rgba(255,93,108,0.6)" } : GOLD_TEXT}>
                      {secondsLeft === null ? "--:--" : `00:${String(secondsLeft).padStart(2, "0")}`}
                    </div>
                    {secondsLeft === 0 && <div className="text-[clamp(9px,0.7vw,12px)] font-bold tracking-widest text-[#FF5D6C]">TIME UP</div>}
                  </div>
                  <div className="col-span-3 rounded-2xl flex items-center gap-[1vw] px-[1vw] py-[1vh]"
                    style={leading ? { background: "linear-gradient(135deg, rgba(61,220,151,0.18), rgba(8,13,26,0.7))", border: "2px solid #3DDC97", boxShadow: "0 0 30px rgba(61,220,151,0.3)" } : { background: "rgba(8,13,26,0.7)", border: "1px solid rgba(212,175,55,0.45)" }}>
                    {leading ? (
                      <>
                        {logoUrl(leading.logo_path)
                          ? <img src={logoUrl(leading.logo_path)!} alt="" className="w-[clamp(48px,4.6vw,92px)] h-[clamp(48px,4.6vw,92px)] object-contain rounded-xl bg-white/5 p-1 shrink-0" />
                          : <div className="w-[clamp(48px,4.6vw,92px)] h-[clamp(48px,4.6vw,92px)] rounded-xl flex items-center justify-center font-black text-xl shrink-0" style={{ background: "#101a31", color: "#3DDC97" }}>{leading.name.slice(0, 2)}</div>}
                        <div className="min-w-0">
                          <div className="text-[clamp(10px,0.8vw,14px)] font-bold uppercase tracking-[0.3em]" style={{ color: "#3DDC97" }}>Currently Bidding</div>
                          <div className="font-display font-black uppercase leading-tight text-[clamp(16px,1.6vw,32px)]" style={{ color: "#5CF0B0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{leading.name}</div>
                          <div className="text-[clamp(10px,0.8vw,14px)] text-[#C7CEDD]">{fmt(leading.remaining)} pts left · {leading.bought}{maxSquad ? `/${maxSquad}` : ""} squad</div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full text-center">
                        <div className="text-[clamp(10px,0.8vw,14px)] font-bold uppercase tracking-[0.3em] text-[#C7CEDD]">Opening Bid</div>
                        <div className="font-display font-black text-[clamp(20px,2vw,40px)]" style={GOLD_TEXT}>{fmt(basePrice)} PTS</div>
                        <div className="text-[clamp(10px,0.8vw,14px)] text-[#9AA6C2]">Waiting for the first paddle…</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* status strip */}
                <div className="grid grid-cols-4 gap-[0.6vw]">
                  {["OPEN", "GOING ONCE", "GOING TWICE", "SOLD"].map((s) => {
                    const active = status.label === s;
                    return (
                      <div key={s} className="rounded-xl py-[0.9vh] text-center font-display font-black tracking-wider text-[clamp(10px,0.95vw,18px)] transition-all"
                        style={active
                          ? { background: `linear-gradient(180deg, ${status.color}33, ${status.color}10)`, border: `2px solid ${status.color}`, color: status.color, boxShadow: `0 0 24px ${status.color}55` }
                          : { background: "rgba(8,13,26,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#56607A" }}>
                        {active && <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle animate-pulse" style={{ background: status.color }} />}{s}
                      </div>
                    );
                  })}
                </div>

                {/* recent bids */}
                <div className="rounded-xl px-3 py-2 min-h-0 overflow-hidden" style={{ background: "rgba(8,13,26,0.55)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <div className="text-[clamp(9px,0.7vw,12px)] font-bold uppercase tracking-[0.3em] text-[#9AA6C2] mb-1">Bid Trail</div>
                  <div className="flex gap-2 overflow-hidden whitespace-nowrap">
                    {[...(auction.bid_history || [])].reverse().slice(0, 6).map((b: any, i: number) => (
                      <span key={`${b.ts}-${i}`} className="px-2.5 py-1 rounded-lg text-[clamp(10px,0.8vw,14px)]"
                        style={{ background: i === 0 ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.04)", color: i === 0 ? "#F0C94A" : "#C7CEDD", fontWeight: i === 0 ? 800 : 500 }}>
                        {b.teamName} · {fmt(b.amount)}
                      </span>
                    ))}
                    {!(auction.bid_history || []).length && <span className="text-[clamp(10px,0.8vw,14px)] text-[#56607A]">No bids yet</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT – TEAMS / PURSE */}
        <section className="relative rounded-2xl flex flex-col min-h-0 overflow-hidden" style={PANEL}>
          <GoldCorners />
          <PanelTitle icon="🏆">All Teams · Purse &amp; Squad</PanelTitle>
          <div className="grid grid-cols-[2.3fr_1fr_0.55fr_0.55fr] gap-2 px-3 pt-2 pb-1 text-[clamp(8px,0.65vw,12px)] font-bold uppercase tracking-wider text-[#9AA6C2]">
            <span>Team</span><span className="text-right">Purse Left</span><span className="text-center">Bought</span><span className="text-center">Slots</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-[0.5vh]">
            {teamStats.map((t: any) => {
              const isLeading = auction?.current_team_id === t.id;
              const inBidding = bidTeamIds.has(t.id);
              const logo = logoUrl(t.logo_path);
              const spentPct = t.total ? Math.min(100, (t.spent / t.total) * 100) : 0;
              const squadPct = maxSquad ? Math.min(100, (t.bought / maxSquad) * 100) : 0;
              return (
                <div key={t.id} className="rounded-xl px-2 py-[0.7vh] transition-all"
                  style={isLeading
                    ? { background: "linear-gradient(90deg, rgba(61,220,151,0.22), rgba(61,220,151,0.05))", border: "1.5px solid #3DDC97", boxShadow: "0 0 18px rgba(61,220,151,0.25)" }
                    : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(212,175,55,0.14)" }}>
                  <div className="grid grid-cols-[2.3fr_1fr_0.55fr_0.55fr] gap-2 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-[clamp(24px,2vw,38px)] h-[clamp(24px,2vw,38px)] rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#101a31" }}>
                        {logo ? <img src={logo} alt="" className="w-full h-full object-contain p-0.5" /> : <span className="text-[10px] font-bold" style={{ color: "#F0C94A" }}>{t.name.slice(0, 2)}</span>}
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
                    <div title="Purse spent" className="h-1 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width: `${spentPct}%`, background: "linear-gradient(90deg,#8C6A1C,#F0C94A)" }} /></div>
                    <div title="Squad filled" className="h-1 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width: `${squadPct}%`, background: "linear-gradient(90deg,#1E7A5A,#3DDC97)" }} /></div>
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

      {/* BOTTOM: summary + ticker */}
      <footer className="relative z-10 px-[1.4vw] pb-[1vh]">
        <div className="rounded-2xl grid grid-cols-2 md:grid-cols-[1.4fr_repeat(5,1fr)_1.6fr] items-stretch overflow-hidden" style={PANEL}>
          <div className="flex items-center gap-3 px-4 py-[1vh] col-span-2 md:col-span-1 border-b md:border-b-0 md:border-r" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
            <span className="text-[clamp(10px,0.75vw,13px)] font-bold uppercase tracking-[0.2em] text-[#9AA6C2] shrink-0">Next Up</span>
            {nextPlayer ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-[clamp(30px,2.4vw,44px)] h-[clamp(30px,2.4vw,44px)] rounded-full overflow-hidden shrink-0" style={{ border: "1px solid #D4AF37" }}>
                  {photoUrl(nextPlayer.photo_path) ? <img src={photoUrl(nextPlayer.photo_path)!} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ background: "#101a31", color: "#F0C94A" }}>{nextPlayer.full_name?.slice(0, 1)}</div>}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate text-[clamp(11px,0.9vw,16px)]">{nextPlayer.full_name}</div>
                  <div className="text-[clamp(9px,0.7vw,12px)] text-[#9AA6C2] truncate">{[nextPlayer.playing_role, nextPlayer.auction_category].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            ) : <span className="text-[clamp(10px,0.8vw,14px)] text-[#56607A]">{remainingInRound > 1 ? "Loading…" : "Last player of this list"}</span>}
          </div>
          {[
            ["Teams", teamStats.length],
            ["Players", pool.length],
            ["Sold", soldInRound],
            ["Remaining", remainingInRound],
            [isUnsoldRound ? "Round" : "Unsold Queue", isUnsoldRound ? "Unsold" : unsoldCount || unsoldInRound],
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
    </div>
  );
}
