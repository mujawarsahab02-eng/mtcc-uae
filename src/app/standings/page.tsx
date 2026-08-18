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

export default async function StandingsPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("match_public").select("*").order("match_date", { ascending: true, nullsFirst: false }),
    supabase.from("team_public").select("*"),
  ]);

  const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name || "TBA";

  const standings = (teams ?? []).map((team) => {
    const played = (matches ?? []).filter((m) => m.status === "Completed" && (m.team_a_id === team.id || m.team_b_id === team.id));
    const won = played.filter((m) => !m.is_tie && m.winner_id === team.id).length;
    const tied = played.filter((m) => m.is_tie).length;
    const lost = played.filter((m) => !m.is_tie && m.winner_id && m.winner_id !== team.id).length;
    const points = won * 2 + tied * 1;
    return { team, played: played.length, won, lost, tied, points };
  }).sort((a, b) => b.points - a.points || b.won - a.won);

  const fixtures = (matches ?? []).sort((a, b) => (a.match_date || "9999").localeCompare(b.match_date || "9999"));

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Live Standings</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Points Table</h1>
        <p className="text-sm text-slateText">Win = 2 points · Tie/No Result = 1 point · Loss = 0 points</p>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="rounded-2xl border border-black/5 shadow-sm bg-white overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="bg-cream text-slateText text-[11px] uppercase tracking-wide">
                  <th className="text-left py-3 px-4">Team</th>
                  <th className="py-3 px-2">P</th>
                  <th className="py-3 px-2">W</th>
                  <th className="py-3 px-2">L</th>
                  <th className="py-3 px-2">T</th>
                  <th className="py-3 px-3 text-orange">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team.id} className="border-t border-black/5" style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.012)" }}>
                    <td className="py-3 px-4 font-semibold text-navyText">{i + 1}. {s.team.name}</td>
                    <td className="text-center py-3 px-2 text-slateText">{s.played}</td>
                    <td className="text-center py-3 px-2 text-slateText">{s.won}</td>
                    <td className="text-center py-3 px-2 text-slateText">{s.lost}</td>
                    <td className="text-center py-3 px-2 text-slateText">{s.tied}</td>
                    <td className="text-center py-3 px-3 font-bold text-orange">{s.points}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slateText">No teams yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="font-display font-black text-2xl text-navyText mb-5">Fixtures & Results</h2>
        <div className="space-y-3">
          {fixtures.length === 0 && <div className="text-sm text-slateText text-center py-8">Fixtures will be announced soon.</div>}
          {fixtures.map((m) => {
            const pill = statusPill(m.status);
            const cardInner = (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] text-slateText mb-1">{m.stage}{m.match_number ? ` · Match ${m.match_number}` : ""}</div>
                  <div className="text-sm font-semibold text-navyText">{teamName(m.team_a_id)} <span className="text-slateText">vs</span> {teamName(m.team_b_id)}</div>
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
