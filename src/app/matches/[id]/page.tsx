import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import MatchCentreClient from "./MatchCentreClient";

export const revalidate = 0;

export default async function MatchCentrePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: match } = await supabase.from("match_public").select("*").eq("id", params.id).single();
  if (!match) notFound();

  const [{ data: teamA }, { data: teamB }, { data: players }, { data: settings }, { data: innings }] = await Promise.all([
    supabase.from("team_public").select("id, name").eq("id", match.team_a_id).single(),
    supabase.from("team_public").select("id, name").eq("id", match.team_b_id).single(),
    supabase.from("player_public").select("id, full_name, team_id").in("team_id", [match.team_a_id, match.team_b_id]),
    supabase.from("tournament_settings").select("playing_xi, number_of_overs, tournament_name").eq("id", 1).single(),
    supabase.from("innings").select("*").eq("match_id", params.id).order("innings_number"),
  ]);

  const innings1 = (innings ?? []).find((i) => i.innings_number === 1) || null;
  const innings2 = (innings ?? []).find((i) => i.innings_number === 2) || null;

  const [{ data: balls1 }, { data: balls2 }] = await Promise.all([
    innings1 ? supabase.from("balls").select("*").eq("innings_id", innings1.id).order("sequence_no") : Promise.resolve({ data: [] }),
    innings2 ? supabase.from("balls").select("*").eq("innings_id", innings2.id).order("sequence_no") : Promise.resolve({ data: [] }),
  ]);

  return (
    <MatchCentreClient
      match={match}
      teamA={teamA}
      teamB={teamB}
      players={players ?? []}
      settings={{ playingXI: settings?.playing_xi ?? 11, oversLimit: settings?.number_of_overs ?? 16, tournamentName: settings?.tournament_name }}
      initialInnings1={innings1}
      initialInnings2={innings2}
      initialBalls1={balls1 ?? []}
      initialBalls2={balls2 ?? []}
    />
  );
}
