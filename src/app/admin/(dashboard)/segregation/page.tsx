import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import SegregationClient from "./SegregationClient";

export const revalidate = 0;

export default async function SegregationPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const [{ data: players }, { data: categories }] = await Promise.all([
    supabase.from("players").select("id, full_name, playing_role, district, category, auction_category").eq("application_status", "Approved for Auction"),
    supabase.from("auction_categories").select("name").order("sort_order"),
  ]);

  return <SegregationClient initialPlayers={players ?? []} initialCategories={(categories ?? []).map((c) => c.name)} currentRole={profile.role} />;
}
