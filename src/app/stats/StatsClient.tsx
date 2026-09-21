import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import StatsClient from "./StatsClient";

export const revalidate = 60;

export const metadata = {
  title: "Stats & Leaderboards | MTCC UAE",
  description: "Most runs, most wickets, most sixes and more from the Maharashtra Tennis Cricket Championship U.A.E.",
};

export default async function StatsPage() {
  const supabase = createClient();
  const [{ data: batting }, { data: bowling }, { data: fielding }, { data: teams }, { data: innings }, { data: settings }] = await Promise.all([
    supabase.from("player_batting_stats").select("*"),
    supabase.from("player_bowling_stats").select("*"),
    supabase.from("player_fielding_stats").select("*"),
    supabase.from("team_public").select("id, name"),
    supabase.from("innings").select("overs_limit").not("overs_limit", "is", null),
    supabase.from("tournament_settings").select("number_of_overs").eq("id", 1).single(),
  ]);

  // Qualifying minimums follow the format actually being played: the average
  // overs per innings across scored matches (or the tournament setting before
  // any match). 5 overs -> 12 balls for strike rate, 2 overs for economy;
  // 8 overs -> 19 balls and 3 overs; 10 overs -> 24 balls and 4 overs.
  const overs = (innings ?? []).map((i: any) => Number(i.overs_limit)).filter((o: number) => o > 0);
  const avgOvers = overs.length ? overs.reduce((a: number, b: number) => a + b, 0) / overs.length : (settings?.number_of_overs ?? 5);
  const minSrBalls = Math.max(6, Math.round(avgOvers * 2.4));
  const minEconBalls = Math.max(1, Math.round(avgOvers * 0.4)) * 6;

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Tournament Stats</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Leaderboards</h1>
        <p className="text-sm text-slateText">Updated live from every ball scored on mtccuae.com</p>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10">
        <StatsClient batting={batting ?? []} bowling={bowling ?? []} fielding={fielding ?? []} teams={teams ?? []} minSrBalls={minSrBalls} minEconBalls={minEconBalls} />
      </div>

      <Footer />
    </div>
  );
}
