"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function addSponsor(name: string, logoPath: string | null, websiteUrl: string | null): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return { error: "Only Super Admin or Tournament Admin can manage sponsors." };
  if (!name.trim()) return { error: "Sponsor name is required." };

  const supabase = createClient();
  const { count } = await supabase.from("sponsors").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("sponsors").insert({ name: name.trim(), logo_path: logoPath, website_url: websiteUrl, sort_order: count ?? 0 });
  if (error) return { error: error.message };

  await logAudit({ action: "Sponsor Added", entity: "Sponsor", entityId: name, field: "name", previousValue: "—", newValue: name });
  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { ok: true };
}

export async function updateSponsor(id: string, patch: Record<string, any>): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return { error: "Only Super Admin or Tournament Admin can manage sponsors." };

  const supabase = createClient();
  const { error } = await supabase.from("sponsors").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "Sponsor Updated", entity: "Sponsor", entityId: id });
  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSponsor(id: string): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return { error: "Only Super Admin or Tournament Admin can manage sponsors." };

  const supabase = createClient();
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "Sponsor Removed", entity: "Sponsor", entityId: id });
  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return { ok: true };
}
