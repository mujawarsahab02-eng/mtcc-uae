import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

export const revalidate = 30;

function statusPill(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Completed: { bg: "rgba(61,220,151,0.12)", color: "#1E9E6B" },
    Live: { bg: "rgba(212,175,55,0.15)", color: "#A8791F" },
    Abandoned: { bg: "rgba(255,93,108,0.12)", color: "#C13645" },
    Scheduled: { bg: "rgba(78,155,255,0.1)", color: "#2F6FCC" },
  };
  return map[status] || map.Scheduled;
}


const OPEN = "#CFE5FA", WIN = "#C8F0E0", LOSE = "#FBE3B8", SEMI = "#DCD9FB", FINAL = "#F5C542";
type Cell = { t: string; l: string; n?: string; bg: string } | null;
const GROUPS: { name: string; rows: Cell[][] }[] = [
  { name: "Group A", rows: [[
    { t: "Match 1", l: "WK & Brothers vs MI Mumbaikar", bg: OPEN },
    { t: "Match 3", l: "Anas 11 Shriwardhan vs Rising Stars Dubai", bg: OPEN },
    { t: "Match 5 · Winners", l: "W1 vs W3", n: "Winner → Semi-finalist A1", bg: WIN },
    { t: "Match 6 · Losers", l: "L1 vs L3", n: "Loser knocked out", bg: LOSE },
  ], [null, null, null,
    { t: "Match 7 · Eliminator", l: "L5 vs W6", n: "Winner → Semi-finalist A2", bg: LOSE },
  ]] },
  { name: "Group B", rows: [[
    { t: "Match 2", l: "Zainab 11 vs Shams 11 Dubai", bg: OPEN },
    { t: "Match 4", l: "Desert Falcons CC vs Maldoli Indians", bg: OPEN },
    { t: "Match 8 · Winners", l: "W2 vs W4", n: "Winner → Semi-finalist B1", bg: WIN },
    { t: "Match 9 · Losers", l: "L2 vs L4", n: "Loser knocked out", bg: LOSE },
  ], [null, null, null,
    { t: "Match 10 · Eliminator", l: "L8 vs W9", n: "Winner → Semi-finalist B2", bg: LOSE },
  ]] },
];
const KO: { t: string; l: string; bg: string; big?: boolean }[] = [
  { t: "Match 11 · Semi-final 1", l: "A1 vs B1", bg: SEMI },
  { t: "Match 12 · Semi-final 2", l: "A2 vs B2", bg: SEMI },
  { t: "Match 13 · Grand Final", l: "Winners of M11 & M12", bg: FINAL, big: true },
];

export default async function StandingsPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: teams }, { data: labels }] = await Promise.all([
    supabase.from("match_public").select("*").order("match_date", { ascending: true, nullsFirst: false }),
    supabase.from("team_public").select("*"),
    supabase.from("match_labels_public").select("*"),
  ]);

  const teamName = (id: string | null) => teams?.find((t: any) => t.id === id)?.name || "TBA";
  // A picked team's name, or the typed-in placeholder (e.g. "Winner of QF1").
  const sideName = (m: any, side: "a" | "b") => {
    const id = side === "a" ? m.team_a_id : m.team_b_id;
    if (id) return teamName(id);
    const l = (labels ?? []).find((x: any) => x.id === m.id);
    return (side === "a" ? l?.team_a_label : l?.team_b_label) || "TBA";
  };

  const fixtures = (matches ?? []).sort((a: any, b: any) => (a.match_date || "9999").localeCompare(b.match_date || "9999"));

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Season 1</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Tournament Schedule</h1>
        <p className="text-sm text-slateText">Two groups · knockout format · 13 matches</p>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="space-y-5 mb-12">
          {GROUPS.map((g) => (
            <div key={g.name} className="rounded-2xl border border-black/5 shadow-sm bg-white p-4">
              <h2 className="font-display font-black text-lg text-navyText mb-3">{g.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {g.rows.flat().map((c, i) =>
                  c ? (
                    <div key={i} className="rounded-lg p-2.5 text-xs leading-snug text-[#1a1a1a]" style={{ background: c.bg }}>
                      <div className="font-bold text-[11px] mb-0.5">{c.t}</div>
                      <div>{c.l}</div>
                      {c.n && <div className="mt-1 text-[11px] opacity-80">{c.n}</div>}
                    </div>
                  ) : (
                    <div key={i} className="hidden md:block" />
                  )
                )}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-black/5 shadow-sm bg-white p-4">
            <h2 className="font-display font-black text-lg text-navyText mb-3">Knockouts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {KO.map((c) => (
                <div key={c.t} className="rounded-lg p-2.5 text-xs leading-snug text-[#1a1a1a] text-center" style={{ background: c.bg }}>
                  <div className="font-bold text-[11px] mb-0.5">{c.t}</div>
                  <div className={c.big ? "font-bold text-sm" : ""}>{c.l}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slateText mt-3">W = winner, L = loser of that match number.</p>
          </div>
        </div>

        <h2 className="font-display font-black text-2xl text-navyText mb-5">Fixtures & Results</h2>
        <div className="space-y-3">
          {fixtures.length === 0 && <div className="text-sm text-slateText text-center py-8">Fixtures will be announced soon.</div>}
          {fixtures.map((m: any) => {
            const pill = statusPill(m.status);
            const cardInner = (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] text-slateText mb-1">{m.stage}{m.match_number ? ` · Match ${m.match_number}` : ""}</div>
                  <div className="text-sm font-semibold text-navyText">{sideName(m, "a")} <span className="text-slateText">vs</span> {sideName(m, "b")}</div>
                  <div className="text-[11px] text-slateText mt-1">{m.match_date || "Date TBA"} {m.match_time || ""} {m.ground ? `· ${m.ground}` : ""}</div>
                  {m.status === "Completed" && (
                    <div className="text-xs text-orange mt-1.5">
                      {m.team_a_score && <span>{teamName(m.team_a_id)}: {m.team_a_score}{m.team_a_overs ? ` (${m.team_a_overs} ov)` : ""} </span>}
                      {m.team_b_score && <span>· {teamName(m.team_b_id)}: {m.team_b_score}{m.team_b_overs ? ` (${m.team_b_overs} ov)` : ""}</span>}
                      <div className="text-navyText font-semibold mt-0.5">{m.is_tie ? "Match Tied" : m.winner_id ? `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}` : ""}</div>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: pill.bg, color: pill.color }}>{m.status}</span>
              </div>
            );
            if (m.status === "Live" || m.status === "Completed") {
              return (
                <Link key={m.id} href={`/matches/${m.id}`} className="rounded-xl border border-black/5 bg-white shadow-sm p-4 block hover:-translate-y-0.5 transition-transform">
                  {cardInner}
                </Link>
              );
            }
            return (
              <div key={m.id} className="rounded-xl border border-black/5 bg-white shadow-sm p-4">
                {cardInner}
              </div>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
