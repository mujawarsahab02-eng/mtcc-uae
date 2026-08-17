import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import FixturesClient from "./FixturesClient";

export const revalidate = 0;

export default async function FixturesPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const [{ data: matches }, { data: teams }] = await Promise.all([
    supabase.from("matches").select("*").order("match_date", { ascending: true, nullsFirst: false }).order("match_number"),
    supabase.from("teams").select("id, name").order("created_at"),
  ]);

  const canManage = ["Super Admin", "Tournament Admin", "Scorer"].includes(profile.role);

  return <FixturesClient initialMatches={matches ?? []} teams={teams ?? []} canManage={canManage} />;
}
