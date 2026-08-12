import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import SettingsForm from "./SettingsForm";

export const revalidate = 0;

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  return (
    <SettingsForm
      settings={settings}
      canEdit={SETTINGS_EDIT_ROLES.includes(profile.role)}
      canToggleOverseas={profile.role === "Super Admin"}
      currentRole={profile.role}
    />
  );
}
