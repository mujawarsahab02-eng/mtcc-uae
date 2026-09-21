import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import { notFound } from "next/navigation";
import ScoringClient from "./ScoringClient";

export const revalidate = 0;

export default async function ScoringPage({ params }: { params: { matchId: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: match } = await supabase.from("matches").select("*").eq("id", params.matchId).single();
  if (!match) notFound();

  const [{ data: teamA }, { data: teamB }, { data: players }, { data: settings }, { data: innings }, { data: xiRows }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", match.team_a_id).single(),
    supabase.from("teams").select("id, name").eq("id", match.team_b_id).single(),
    supabase.from("players").select("id, full_name, team_id, team_role").in("team_id", [match.team_a_id, match.team_b_id]),
    supabase.from("tournament_settings").select("playing_xi, number_of_overs").eq("id", 1).single(),
    supabase.from("innings").select("*").eq("match_id", params.matchId).order("innings_number"),
    supabase.from("match_players").select("player_id, team_id, is_captain, is_wicket_keeper").eq("match_id", params.matchId),
  ]);

  if (!teamA || !teamB) notFound();

  // Everyone in each squad except non-playing Owners, alphabetical.
  const squad = (players ?? [])
    .filter((p: any) => p.team_role !== "Owner")
    .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

  const innings1 = (innings ?? []).find((i: any) => i.innings_number === 1) || null;
  const innings2 = (innings ?? []).find((i: any) => i.innings_number === 2) || null;

  const [{ data: balls1 }, { data: balls2 }] = await Promise.all([
    innings1 ? supabase.from("balls").select("*").eq("innings_id", innings1.id).order("sequence_no") : Promise.resolve({ data: [] }),
    innings2 ? supabase.from("balls").select("*").eq("innings_id", innings2.id).order("sequence_no") : Promise.resolve({ data: [] }),
  ]);

  const canScore = ["Super Admin", "Tournament Admin", "Scorer"].includes(profile.role);

  return (
    <ScoringClient
      match={match}
      teamA={teamA}
      teamB={teamB}
      squadA={squad.filter((p: any) => p.team_id === match.team_a_id)}
      squadB={squad.filter((p: any) => p.team_id === match.team_b_id)}
      xiRows={xiRows ?? []}
      settings={{ playingXI: settings?.playing_xi ?? 11, oversLimit: match.overs_per_innings ?? settings?.number_of_overs ?? 16 }}
      initialInnings1={innings1}
      initialInnings2={innings2}
      initialBalls1={balls1 ?? []}
      initialBalls2={balls2 ?? []}
      canScore={canScore}
      isSuperAdmin={profile.role === "Super Admin"}
    />
  );
}
