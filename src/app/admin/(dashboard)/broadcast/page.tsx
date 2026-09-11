import { requireProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import BroadcastClient from "./BroadcastClient";

export const revalidate = 0;

export default async function BroadcastPage() {
  const profile = await requireProfile();
  const canSend = SETTINGS_EDIT_ROLES.includes(profile.role);
  return <BroadcastClient currentRole={profile.role} canSend={canSend} />;
}
