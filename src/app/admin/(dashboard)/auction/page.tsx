import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import AuctionControlRoom from "./AuctionControlRoom";

export const revalidate = 0;

export default async function AuctionPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: auction }, { data: players }, { data: teams }, { data: settings }] = await Promise.all([
    supabase.from("auction_state").select("*").eq("id", 1).single(),
    supabase.from("players").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <AuctionControlRoom
      initialAuction={auction}
      initialPlayers={players ?? []}
      initialTeams={teams ?? []}
      settings={settings}
      currentRole={profile.role}
    />
  );
}
