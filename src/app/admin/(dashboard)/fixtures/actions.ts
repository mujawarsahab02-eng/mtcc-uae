"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const MATCH_ROLES = ["Super Admin", "Tournament Admin", "Scorer"];

async function guardRole() {
  const profile = await getCurrentProfile();
  if (!profile || !MATCH_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin, Tournament Admin or Scorer can manage fixtures." };
  }
  return { profile };
}

export async function addMatch(match: Record<string, any>): Promise<any> {
  const guard: any = await guardRole();
  if (guard.error) return guard;

  const supabase = createClient();
  const { error } = await supabase.from("matches").insert(match);
  if (error) return { error: error.message };

  await logAudit({ action: "Match Added", entity: "Match", entityId: String(match.match_number || "new") });
  revalidatePath("/admin/fixtures");
  revalidatePath("/standings");
  return { ok: true };
}

export async function updateMatch(id: string, patch: Record<string, any>): Promise<any> {
  const guard: any = await guardRole();
  if (guard.error) return guard;

  const supabase = createClient();
  const { data: before } = await supabase.from("matches").select("*").eq("id", id).single();
  const { error } = await supabase.from("matches").update(patch).eq("id", id);
  if (error) return { error: error.message };

  if (before) {
    for (const field of Object.keys(patch)) {
      if (JSON.stringify(before[field]) !== JSON.stringify(patch[field])) {
        await logAudit({ action: "Match Updated", entity: "Match", entityId: id, field, previousValue: before[field], newValue: patch[field] });
      }
    }
  }
  revalidatePath("/admin/fixtures");
  revalidatePath("/standings");
  return { ok: true };
}

export async function deleteMatch(id: string): Promise<any> {
  const guard: any = await guardRole();
  if (guard.error) return guard;

  const supabase = createClient();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "Match Removed", entity: "Match", entityId: id });
  revalidatePath("/admin/fixtures");
  revalidatePath("/standings");
  return { ok: true };
}
