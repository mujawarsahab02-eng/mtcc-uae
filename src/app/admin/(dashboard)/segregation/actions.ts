"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function addCategory(name: string) {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return { error: "Not authorised." };
  const supabase = createClient();
  const { count } = await supabase.from("auction_categories").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("auction_categories").insert({ name, sort_order: count ?? 0 });
  if (error) return { error: error.message };
  revalidatePath("/admin/segregation");
  return { ok: true };
}

export async function removeCategory(name: string) {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return { error: "Not authorised." };
  const supabase = createClient();
  await supabase.from("players").update({ auction_category: null }).eq("auction_category", name);
  const { error } = await supabase.from("auction_categories").delete().eq("name", name);
  if (error) return { error: error.message };
  revalidatePath("/admin/segregation");
  return { ok: true };
}
