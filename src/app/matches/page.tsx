import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

export const revalidate = 30;

export const metadata = {
  title: "Matches | MTCC UAE",
  description: "Live scores, upcoming fixtures and results from the Maharashtra Tennis Cricket Championship U.A.E.",
};

function fmtOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export default async function MatchesPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: teams }, { data: labels }, { data: innings }] = await Promise.all([
    supabase.from("match_public").select("*"),
    supabase.from("team_public").select("id, name"),
    supabase.from("match_labels_public").select("id, team_a_label, team_b_label"),
    supabase.from("innings").select("match_id, innings_number, batting_team_id, total_runs, total_wickets, legal_balls, status, opening_striker_id"),
  ]);

  const teamName = (id: string | null) => (teams ?? []).find((t: any) => t.id === id)?.name || null;
  const side = (m: any, s: "a" | "b") => {
    const id = s === "a" ? m.team_a_id : m.team_b_id;
    const l = (labels ?? []).find((x: any) => x.id === m.id);
    return teamName(id) || (s === "a" ? l?.team_a_label : l?.team_b_label) || "TBA";
  };
  const scoreLines = (m: any) =>
    (innings ?? [])
      .filter((i: any) => i.match_id === m.id && i.opening_striker_id)
      .sort((a: any, b: any) => a.innings_number - b.innings_number)
      .map((i: any) => `${teamName(i.batting_team_id)} ${i.total_runs}/${i.total_wickets} (${fmtOvers(i.legal_balls)})`);

  const all = matches ?? [];
  const byDate = (a: any, b: any) => `${a.match_date || "9999"} ${a.match_time || ""}`.localeCompare(`${b.match_date || "9999"} ${b.match_time || ""}`);
  const live = all.filter((m: any) => m.status === "Live");
  const upcoming = all.filter((m: any) => m.status === "Scheduled").sort(byDate);
  const results = all.filter((m: any) => m.status === "Completed" || m.status === "Abandoned").sort((a: any, b: any) => byDate(b, a));

  const card = (m: any, kind: "live" | "upcoming" | "result") => {
    const lines = scoreLines(m);
    const result = m.status === "Abandoned" ? "Match abandoned"
      : m.is_tie ? "Match tied"
      : m.winner_id ? `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}` : null;
    return (
      <Link key={m.id} href={`/matches/${m.id}`}
        className="block rounded-xl border bg-white shadow-sm p-4 hover:-translate-y-0.5 transition-transform"
        style={{ borderColor: kind === "live" ? "rgba(255,77,94,0.35)" : "rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[11px] text-slateText">{m.stage}{m.match_number ? ` · Match ${m.match_number}` : ""}</div>
          {kind === "live" && (
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider" style={{ color: "#E0364A" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#FF4D5E" }} /> LIVE
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-navyText">{side(m, "a")} <span className="text-slateText">vs</span> {side(m, "b")}</div>
        {lines.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {lines.map((l: string) => <div key={l} className="text-xs text-navyText font-medium">{l}</div>)}
          </div>
        )}
        {kind === "result" && result && <div className="text-xs text-orange font-semibold mt-1.5">{result}</div>}
        <div className="text-[11px] text-slateText mt-1.5">{m.match_date || "Date TBA"} {m.match_time || ""} {m.ground ? `· ${m.ground}` : ""}</div>
      </Link>
    );
  };

  const section = (title: string, list: any[], kind: "live" | "upcoming" | "result", empty: string) => (
    <section className="mb-10">
      <h2 className="font-display font-black text-xl text-navyText mb-4">{title}</h2>
      {list.length === 0 ? <div className="text-sm text-slateText">{empty}</div> : <div className="space-y-3">{list.map((m) => card(m, kind))}</div>}
    </section>
  );

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />
      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Match Centre</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Matches</h1>
        <p className="text-sm text-slateText">Live scores, upcoming fixtures and results</p>
      </div>
      <div className="max-w-3xl mx-auto px-5 py-10">
        {live.length > 0 && section("🔴 Live Now", live, "live", "")}
        {section("Upcoming", upcoming, "upcoming", "Fixtures will be announced soon.")}
        {section("Results", results, "result", "No results yet.")}
        <div className="text-center">
          <Link href="/stats" className="text-sm font-semibold text-orange underline">View Stats & Leaderboards →</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
