import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import SponsorsClient from "./SponsorsClient";

export const revalidate = 0;

export default async function SponsorsPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: sponsors } = await supabase.from("sponsors").select("*").order("sort_order");

  return <SponsorsClient initialSponsors={sponsors ?? []} canManage={SETTINGS_EDIT_ROLES.includes(profile.role)} />;
}
