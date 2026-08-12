import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import SquadsClient from "./SquadsClient";

export const revalidate = 0;

export default async function SquadsPage() {
  await requireProfile();
  const supabase = createClient();
  const [{ data: teams }, { data: players }, { data: settings }] = await Promise.all([
    supabase.from("teams").select("*").order("created_at"),
    supabase.from("players").select("*").eq("application_status", "Sold / Selected"),
    supabase.from("tournament_settings").select("currency, max_squad_size, tournament_name, season").eq("id", 1).single(),
  ]);

  return <SquadsClient teams={teams ?? []} players={players ?? []} settings={settings} />;
}
