import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import TeamsClient from "./TeamsClient";

export const revalidate = 0;

export default async function TeamsPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const [{ data: teams }, { data: settings }] = await Promise.all([
    supabase.from("teams").select("*").order("created_at"),
    supabase.from("tournament_settings").select("currency").eq("id", 1).single(),
  ]);

  return <TeamsClient initialTeams={teams ?? []} settings={settings} currentRole={profile.role} />;
}
