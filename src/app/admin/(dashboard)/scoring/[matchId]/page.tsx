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

  const [{ data: teamA }, { data: teamB }, { data: players }, { data: settings }, { data: innings }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("id", match.team_a_id).single(),
    supabase.from("teams").select("id, name").eq("id", match.team_b_id).single(),
    supabase.from("players").select("id, full_name, team_id").in("team_id", [match.team_a_id, match.team_b_id]).eq("application_status", "Sold / Selected"),
    supabase.from("tournament_settings").select("playing_xi, number_of_overs").eq("id", 1).single(),
    supabase.from("innings").select("*").eq("match_id", params.matchId).order("innings_number"),
  ]);

  const innings1 = (innings ?? []).find((i) => i.innings_number === 1) || null;
  const innings2 = (innings ?? []).find((i) => i.innings_number === 2) || null;

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
      squadA={(players ?? []).filter((p) => p.team_id === match.team_a_id)}
      squadB={(players ?? []).filter((p) => p.team_id === match.team_b_id)}
      settings={{ playingXI: settings?.playing_xi ?? 11, oversLimit: settings?.number_of_overs ?? 16 }}
      initialInnings1={innings1}
      initialInnings2={innings2}
      initialBalls1={balls1 ?? []}
      initialBalls2={balls2 ?? []}
      canScore={canScore}
    />
  );
}
