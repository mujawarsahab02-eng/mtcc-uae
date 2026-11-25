import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import GalleryAdmin from "./GalleryAdmin";

export const revalidate = 0;

export default async function GalleryAdminPage() {
  const profile = await requireProfile();
  const supabase: any = createClient();
  const { data: items } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false });
  return <GalleryAdmin initialItems={items ?? []} canManage={SETTINGS_EDIT_ROLES.includes(profile.role)} />;
}
