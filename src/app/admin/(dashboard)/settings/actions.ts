"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function saveSettings(next: Record<string, any>): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) {
    return { error: "You do not have permission to edit Tournament Settings." };
  }

  const supabase = createClient();
  const { data: before } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  const { error } = await supabase.from("tournament_settings").update(next).eq("id", 1);
  if (error) return { error: error.message };

  if (before) {
    for (const key of Object.keys(next)) {
      if (before[key] !== next[key]) {
        await logAudit({ action: "Settings Changed", entity: "Settings", entityId: "tournament", field: key, previousValue: before[key], newValue: next[key] });
      }
    }
  }

  // Resize team slots if number_of_teams changed (mirrors the artifact's
  // Settings tab behaviour — add/remove blank "Team N" rows to match).
  if (before && Number(before.number_of_teams) !== Number(next.number_of_teams)) {
    const targetCount = Number(next.number_of_teams);
    const { data: teams } = await supabase.from("teams").select("id, name").order("created_at", { ascending: true });
    const current = teams ?? [];
    if (targetCount > current.length) {
      const rows = Array.from({ length: targetCount - current.length }, (_, i) => ({
        name: `Team ${current.length + i + 1}`,
        entry_fee_amount: next.team_entry_fee ?? before.team_entry_fee,
        auction_points: next.auction_points_per_team ?? before.auction_points_per_team,
      }));
      await supabase.from("teams").insert(rows);
    } else if (targetCount < current.length) {
      const toRemove = current.slice(targetCount).map((t) => t.id);
      await supabase.from("teams").delete().in("id", toRemove);
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/teams");
  revalidatePath("/admin");
  return { ok: true };
}
