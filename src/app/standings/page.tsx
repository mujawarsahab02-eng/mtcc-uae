import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui";

export const revalidate = 30;

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
    <div className="min-h-screen bg-bg pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">Live Standings</div>
            <div className="font-bold text-sm font-display">Maharashtra Tennis Cricket Championship UAE</div>
          </div>
          <Link href="/" className="text-xs text-mutedDim underline">Home</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 pt-8">
        <h1 className="text-2xl font-bold font-display mb-1">Points Table</h1>
        <p className="text-sm text-mutedDim mb-6">Win = 2 points · Tie/No Result = 1 point · Loss = 0 points</p>

        <div className="rounded-2xl border border-line overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bgCard text-mutedDim text-[11px] uppercase tracking-wide">
                <th className="text-left py-3 px-4">Team</th>
                <th className="py-3 px-2">P</th>
                <th className="py-3 px-2">W</th>
                <th className="py-3 px-2">L</th>
                <th className="py-3 px-2">T</th>
                <th className="py-3 px-3 text-goldBright">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team.id} className="border-t border-line" style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td className="py-3 px-4 font-semibold">{i + 1}. {s.team.name}</td>
                  <td className="text-center py-3 px-2 text-muted">{s.played}</td>
                  <td className="text-center py-3 px-2 text-muted">{s.won}</td>
                  <td className="text-center py-3 px-2 text-muted">{s.lost}</td>
                  <td className="text-center py-3 px-2 text-muted">{s.tied}</td>
                  <td className="text-center py-3 px-3 font-bold text-goldBright">{s.points}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-mutedDim">No teams yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold font-display mb-4">Fixtures & Results</h2>
        <div className="space-y-2">
          {fixtures.length === 0 && <div className="text-sm text-mutedDim text-center py-8">Fixtures will be announced soon.</div>}
          {fixtures.map((m) => (
            <div key={m.id} className="rounded-xl border border-line bg-bgCard p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] text-mutedDim mb-1">{m.stage}{m.match_number ? ` · Match ${m.match_number}` : ""}</div>
                  <div className="text-sm font-semibold">{teamName(m.team_a_id)} <span className="text-mutedDim">vs</span> {teamName(m.team_b_id)}</div>
                  <div className="text-[11px] text-mutedDim mt-1">{m.match_date || "Date TBA"} {m.match_time || ""} {m.ground ? `· ${m.ground}` : ""}</div>
                  {m.status === "Completed" && (
                    <div className="text-xs text-goldBright mt-1.5">
                      {m.team_a_score && <span>{teamName(m.team_a_id)}: {m.team_a_score}{m.team_a_overs ? ` (${m.team_a_overs} ov)` : ""} </span>}
                      {m.team_b_score && <span>· {teamName(m.team_b_id)}: {m.team_b_score}{m.team_b_overs ? ` (${m.team_b_overs} ov)` : ""}</span>}
                      <div className="text-ink font-semibold mt-0.5">{m.is_tie ? "Match Tied" : m.winner_id ? `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}` : ""}</div>
                    </div>
                  )}
                </div>
                <Badge tone={m.status === "Completed" ? "green" : m.status === "Live" ? "gold" : m.status === "Abandoned" ? "red" : "blue"}>{m.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
