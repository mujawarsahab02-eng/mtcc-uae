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

export default async function MatchesPage({ searchParams }: { searchParams: { f?: string } }) {
  const supabase = createClient();
  const [{ data: matches }, { data: regTeams }, { data: guestTeams }, { data: labels }, { data: innings }] = await Promise.all([
    supabase.from("match_public").select("*"),
    supabase.from("team_public").select("id, name"),
    supabase.from("guest_teams").select("id, name"),
    supabase.from("match_labels_public").select("id, team_a_label, team_b_label"),
    supabase.from("innings").select("match_id, innings_number, batting_team_id, total_runs, total_wickets, legal_balls, status, opening_striker_id, target, overs_limit"),
  ]);

  const teams = [...(regTeams ?? []), ...(guestTeams ?? [])];
  const teamName = (id: string | null) => (teams ?? []).find((t: any) => t.id === id)?.name || null;
  const side = (m: any, s: "a" | "b") => {
    const id = s === "a" ? m.team_a_id : m.team_b_id;
    const l = (labels ?? []).find((x: any) => x.id === m.id);
    return teamName(id) || (s === "a" ? l?.team_a_label : l?.team_b_label) || "TBA";
  };
  const inningsOf = (m: any) =>
    (innings ?? [])
      .filter((i: any) => i.match_id === m.id && i.opening_striker_id)
      .sort((a: any, b: any) => a.innings_number - b.innings_number);

  const all = matches ?? [];
  // Date, then start time, then match number — so same-day fixtures run Match 1, 2, 3...
  const byDate = (a: any, b: any) =>
    `${a.match_date || "9999"} ${a.match_time || ""}`.localeCompare(`${b.match_date || "9999"} ${b.match_time || ""}`) ||
    (a.match_number ?? 9999) - (b.match_number ?? 9999);
  const live = all.filter((m: any) => m.status === "Live").sort(byDate);
  const upcoming = all.filter((m: any) => m.status === "Scheduled").sort(byDate);
  const results = all.filter((m: any) => m.status === "Completed" || m.status === "Abandoned").sort((a: any, b: any) => byDate(b, a));

  const filter = ["live", "upcoming", "past"].includes(searchParams?.f ?? "") ? (searchParams.f as string) : "all";

  const card = (m: any, kind: "live" | "upcoming" | "result") => {
    const inn = inningsOf(m);
    const aName = side(m, "a"), bName = side(m, "b");
    const rowFor = (teamId: string | null, name: string) => {
      const i = inn.find((x: any) => x.batting_team_id === teamId);
      const batting = kind === "live" && i?.status === "In Progress";
      const won = kind === "result" && m.winner_id && m.winner_id === teamId;
      return (
        <div className="flex items-baseline justify-between gap-3 py-1">
          <span className={`text-sm truncate ${batting || won ? "font-bold text-navyText" : "text-slateText"}`}>{name}</span>
          {i ? (
            <span className={`shrink-0 tabular-nums ${batting || won ? "font-bold text-navyText text-lg" : "text-slateText text-base"}`}>
              {i.total_runs}/{i.total_wickets} <span className="text-xs font-normal text-slateText">({fmtOvers(i.legal_balls)})</span>
            </span>
          ) : <span className="text-xs text-slateText">{kind === "upcoming" ? "" : "Yet to bat"}</span>}
        </div>
      );
    };
    const cur = inn.find((i: any) => i.status === "In Progress");
    let footer = "";
    if (kind === "live") {
      if (cur?.target) {
        const need = Math.max(0, cur.target - cur.total_runs);
        const left = Math.max(0, (cur.overs_limit ?? 16) * 6 - cur.legal_balls);
        footer = `Need ${need} run${need === 1 ? "" : "s"} in ${left} ball${left === 1 ? "" : "s"}`;
      } else if (inn.length === 1 && inn[0].status === "Completed") {
        footer = `Innings break · Target ${inn[0].total_runs + 1}`;
      } else if (cur) {
        footer = `${side(m, cur.batting_team_id === m.team_a_id ? "a" : "b")} batting`;
      } else footer = "Match about to start";
    } else if (kind === "result") {
      footer = m.status === "Abandoned" ? "Match abandoned" : m.is_tie ? "Match tied"
        : m.winner_id ? `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}` : "Result awaited";
    } else {
      footer = m.match_time ? `Starts ${m.match_time}` : "Time to be announced";
    }
    return (
      <Link key={m.id} href={`/matches/${m.id}`}
        className="block rounded-2xl border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition overflow-hidden"
        style={{ borderColor: kind === "live" ? "rgba(255,77,94,0.4)" : "rgba(0,0,0,0.07)" }}>
        <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navyText truncate">{m.stage || "Match"}{m.match_number ? ` · Match ${m.match_number}` : ""}</div>
            <div className="text-[11px] text-slateText truncate">{m.ground || "Venue TBA"}{m.match_date ? ` · ${m.match_date}` : ""}</div>
          </div>
          {kind === "live" ? (
            <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-white px-2.5 py-1 rounded-full" style={{ background: "#E0364A" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          ) : kind === "result" ? (
            <span className="shrink-0 text-[10px] font-extrabold tracking-wider text-white px-2.5 py-1 rounded-full bg-navy">PAST</span>
          ) : (
            <span className="shrink-0 text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full" style={{ background: "rgba(212,175,55,0.18)", color: "#8a6d0b" }}>UPCOMING</span>
          )}
        </div>
        <div className="px-4 pt-1 pb-3">
          {rowFor(m.team_a_id, aName)}
          {rowFor(m.team_b_id, bName)}
        </div>
        <div className="px-4 py-2.5 text-xs bg-cream text-navyText">
          <span className={kind === "live" ? "font-semibold" : "font-medium"}>{footer}</span>
        </div>
      </Link>
    );
  };

  const section = (title: string, list: any[], kind: "live" | "upcoming" | "result", empty: string) => (
    <section className="mb-10">
      <h2 className="font-display font-black text-xl text-navyText mb-4">{title}</h2>
      {list.length === 0 ? <div className="text-sm text-slateText">{empty}</div> : <div className="grid sm:grid-cols-2 gap-4">{list.map((m) => card(m, kind))}</div>}
    </section>
  );

  const pills = [
    { k: "all", label: "All" },
    { k: "live", label: `Live${live.length ? ` (${live.length})` : ""}` },
    { k: "upcoming", label: `Upcoming (${upcoming.length})` },
    { k: "past", label: `Past (${results.length})` },
  ];

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />
      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Match Centre</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Matches</h1>
        <p className="text-sm text-slateText">Live scores, upcoming fixtures and results</p>
      </div>
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {pills.map((p) => (
            <Link key={p.k} href={p.k === "all" ? "/matches" : `/matches?f=${p.k}`} replace scroll={false}
              className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border"
              style={filter === p.k ? { background: "#0B1F3A", color: "#fff", borderColor: "#0B1F3A" } : { background: "#fff", color: "#566274", borderColor: "rgba(0,0,0,0.1)" }}>
              {p.label}
            </Link>
          ))}
        </div>
        {(filter === "all" || filter === "live") && (live.length > 0 || filter === "live") && section("Live Now", live, "live", "No match is live right now.")}
        {(filter === "all" || filter === "upcoming") && section("Upcoming", upcoming, "upcoming", "Fixtures will be announced soon.")}
        {(filter === "all" || filter === "past") && section("Past Results", results, "result", "No results yet.")}
        <div className="text-center">
          <Link href="/stats" className="text-sm font-semibold text-orange underline">View Stats & Leaderboards →</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
