import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import { notFound } from "next/navigation";
import ScoringClient from "./ScoringClient";
import ScorerBar from "./ScorerBar";
import GuestTeamSetup from "./GuestTeamSetup";

export const revalidate = 0;

export default async function ScoringPage({ params, searchParams }: { params: { matchId: string }; searchParams?: { guest?: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: match } = await supabase.from("matches").select("*").eq("id", params.matchId).single();
  if (!match) notFound();

  // A side is either a registered team or a guest team typed in by the scorer.
  const lookupTeam = async (id: string | null) => {
    if (!id) return null;
    const { data: t } = await supabase.from("team_public").select("id, name").eq("id", id).maybeSingle();
    if (t) return { ...t, isGuest: false };
    const { data: gt } = await supabase.from("guest_teams").select("id, name").eq("id", id).maybeSingle();
    return gt ? { ...gt, isGuest: true } : null;
  };
  const [teamA, teamB] = await Promise.all([lookupTeam(match.team_a_id), lookupTeam(match.team_b_id)]);

  const roleOk = ["Super Admin", "Tournament Admin", "Scorer"].includes(profile.role);
  // One scorer per match: only the person holding the scorer seat can score.
  const canScore = roleOk && match.scorer_id === profile.id;
  const matchOver = match.status === "Completed" || match.status === "Abandoned";
  const scorerBar = (
    <ScorerBar
      matchId={match.id}
      scorerId={match.scorer_id ?? null}
      scorerName={match.scorer_name ?? null}
      handoverTo={match.handover_to ?? null}
      handoverToName={match.handover_to_name ?? null}
      meId={profile.id}
      roleOk={roleOk}
      isSuperAdmin={profile.role === "Super Admin"}
      matchOver={matchOver}
    />
  );

  // Placeholder fixtures ("Winner Match 1") get their real teams automatically once the
  // earlier match is completed. Until then, say what we are waiting for instead of
  // asking the scorer to type team names. Guest scoring stays available via ?guest=1.
  if ((!teamA || !teamB) && searchParams?.guest !== "1") {
    const waiting: string[] = [];
    for (const [team, label] of [[teamA, match.team_a_label], [teamB, match.team_b_label]] as const) {
      if (team || !label) continue;
      const m = /^(winner|loser)( of)? (match|semi[ -]?final|sf) ?#?(\d+)$/i.exec(String(label).trim());
      if (!m) continue;
      const n = /^match$/i.test(m[3]) ? Number(m[4]) : 10 + Number(m[4]);
      waiting.push(`Match ${n}`);
    }
    if (waiting.length > 0) {
      return (
        <>
          {scorerBar}
          <div className="rounded-xl border border-line p-8 text-center">
            <div className="text-xs uppercase tracking-wider text-mutedDim font-semibold mb-2">Teams not decided yet</div>
            <div className="text-lg font-bold mb-2">{match.team_a_label} vs {match.team_b_label}</div>
            <div className="text-sm text-mutedDim mb-5">
              Waiting for the result of {Array.from(new Set(waiting)).join(" and ")}. The teams and squads fill in on their own as soon as that match is completed.
            </div>
            <a href={`/admin/scoring/${match.id}?guest=1`} className="text-xs underline text-mutedDim">Score with custom teams instead</a>
          </div>
        </>
      );
    }
  }

  if (!teamA || !teamB) {
    return (
      <>
        {scorerBar}
        <GuestTeamSetup match={match} teamA={teamA} teamB={teamB} canScore={canScore} />
      </>
    );
  }

  const [{ data: players }, { data: settings }, { data: innings }, { data: xiRows }] = await Promise.all([
    supabase.rpc("scoring_players", { p_match: params.matchId }),
    supabase.from("tournament_settings").select("playing_xi, number_of_overs").eq("id", 1).single(),
    supabase.from("innings").select("*").eq("match_id", params.matchId).order("innings_number"),
    supabase.from("match_players").select("player_id, team_id, is_captain, is_wicket_keeper").eq("match_id", params.matchId),
  ]);

  // Suggest each team's Playing XI from its previous match so the scorer only changes what differs.
  let suggestedXi: any[] = [];
  if ((xiRows ?? []).length === 0) {
    const { data: prev } = await supabase
      .from("match_players")
      .select("player_id, team_id, is_captain, is_wicket_keeper, match_id, matches!inner(match_number)")
      .in("team_id", [match.team_a_id, match.team_b_id])
      .neq("match_id", params.matchId);
    const latest: Record<string, number> = {};
    for (const r of (prev ?? []) as any[]) {
      const no = r.matches?.match_number ?? 0;
      if (no > (latest[r.team_id] ?? -1)) latest[r.team_id] = no;
    }
    suggestedXi = ((prev ?? []) as any[])
      .filter((r) => (r.matches?.match_number ?? 0) === latest[r.team_id])
      .map((r) => ({ player_id: r.player_id, team_id: r.team_id, is_captain: r.is_captain, is_wicket_keeper: r.is_wicket_keeper }));
  }

  // Owners play for their team, so they are in the squad list. The exception is a team that
  // already has 14 other players (Shams 11), where the owner is non-playing.
  const othersByTeam: Record<string, number> = {};
  for (const p of players ?? []) if (p.team_role !== "Owner") othersByTeam[p.team_id] = (othersByTeam[p.team_id] || 0) + 1;
  const squad = (players ?? [])
    .filter((p: any) => p.team_role !== "Owner" || (othersByTeam[p.team_id] || 0) < 14)
    .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

  const innings1 = (innings ?? []).find((i: any) => i.innings_number === 1) || null;
  const innings2 = (innings ?? []).find((i: any) => i.innings_number === 2) || null;

  const [{ data: balls1 }, { data: balls2 }] = await Promise.all([
    innings1 ? supabase.from("balls").select("*").eq("innings_id", innings1.id).order("sequence_no") : Promise.resolve({ data: [] }),
    innings2 ? supabase.from("balls").select("*").eq("innings_id", innings2.id).order("sequence_no") : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
    {scorerBar}
    <ScoringClient
      match={match}
      teamA={teamA}
      teamB={teamB}
      squadA={squad.filter((p: any) => p.team_id === match.team_a_id)}
      squadB={squad.filter((p: any) => p.team_id === match.team_b_id)}
      xiRows={xiRows ?? []}
      suggestedXi={suggestedXi}
      settings={{ playingXI: settings?.playing_xi ?? 11, oversLimit: match.overs_per_innings ?? settings?.number_of_overs ?? 16 }}
      initialInnings1={innings1}
      initialInnings2={innings2}
      initialBalls1={balls1 ?? []}
      initialBalls2={balls2 ?? []}
      canScore={canScore}
      isSuperAdmin={profile.role === "Super Admin"}
    />
    </>
  );
}
