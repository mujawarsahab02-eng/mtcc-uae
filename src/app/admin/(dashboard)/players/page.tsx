import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import PlayersClient from "./PlayersClient";

export const revalidate = 0;

export default async function PlayersPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: players }, { data: settings }, { data: categories }] = await Promise.all([
    supabase.from("players").select("*").order("created_at", { ascending: false }),
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
    supabase.from("auction_categories").select("name").order("sort_order"),
  ]);

  return (
    <PlayersClient
      initialPlayers={players ?? []}
      settings={settings}
      categories={(categories ?? []).map((c) => c.name)}
      currentRole={profile.role}
    />
  );
}
