"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { PLAYER_DECISION_ROLES, DOCUMENT_ACCESS_ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updatePlayer(id: string, patch: Record<string, any>, action?: string): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const financialFields = ["registration_fee_amount", "amount_paid", "payment_reference", "payment_date", "payment_status"];
  const decisionFields = ["application_status", "category", "auction_category"];

  const touchesFinancial = Object.keys(patch).some((k) => financialFields.includes(k));
  const touchesDecision = Object.keys(patch).some((k) => decisionFields.includes(k));

  if (touchesFinancial && !DOCUMENT_ACCESS_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin, Tournament Admin or Finance Admin can edit financial fields." };
  }
  if (touchesDecision && !PLAYER_DECISION_ROLES.includes(profile.role) && profile.role !== "Auction Admin") {
    return { error: "Your role cannot change player status/category." };
  }

  const supabase = createClient();
  const { data: before } = await supabase.from("players").select("*").eq("id", id).single();
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) return { error: error.message };

  if (before) {
    for (const field of Object.keys(patch)) {
      if (before[field] !== patch[field]) {
        await logAudit({ action: action || "Player Updated", entity: "Player", entityId: id, field, previousValue: before[field], newValue: patch[field] });
      }
    }
  }

  revalidatePath("/admin/players");
  revalidatePath("/admin");
  revalidatePath("/admin/segregation");
  return { ok: true };
}

export async function deletePlayer(id: string): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !PLAYER_DECISION_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin or Tournament Admin can delete a player." };
  }

  const supabase = createClient();
  const { data: player } = await supabase.from("players").select("full_name, application_status, team_id, sold_points").eq("id", id).single();
  if (!player) return { error: "Player not found." };

  if (player.application_status === "Sold / Selected" || player.team_id) {
    return { error: "This player has already been sold to a team — remove them from the team/auction result first before deleting." };
  }

  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "Player Deleted", entity: "Player", entityId: id, field: "full_name", previousValue: player.full_name, newValue: "—" });

  revalidatePath("/admin/players");
  revalidatePath("/admin");
  revalidatePath("/admin/segregation");
  return { ok: true };
}

// Assigns a player directly to a team as Owner or Captain/Icon, bypassing
// the auction entirely. Owner costs a fixed amount (from Settings,
// deducted from the team's purse via the same sold_points field the
// auction uses); Captain/Icon is free. Passing "Auction Player" reverts
// them back to the normal auction pool.
export async function assignSpecialRole(playerId: string, teamRole: "Owner" | "Captain/Icon" | "Auction Player", teamId: string | null): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !PLAYER_DECISION_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin or Tournament Admin can assign Owner/Captain-Icon roles." };
  }

  const supabase = createClient();

  if (teamRole === "Auction Player") {
    const { error } = await supabase.from("players").update({
      team_role: "Auction Player", team_id: null, sold_points: null, application_status: "Approved for Auction",
    }).eq("id", playerId);
    if (error) return { error: error.message };
    await logAudit({ action: "Team Role Reset to Auction Player", entity: "Player", entityId: playerId });
    revalidatePath("/admin/players");
    revalidatePath("/admin/teams");
    revalidatePath("/admin/squads");
    return { ok: true };
  }

  if (!teamId) return { error: "Please select a team." };

  const { data: settings } = await supabase.from("tournament_settings").select("owner_fixed_points").eq("id", 1).single();
  const points = teamRole === "Owner" ? (settings?.owner_fixed_points ?? 5000) : 0;

  const { error } = await supabase.from("players").update({
    team_role: teamRole, team_id: teamId, sold_points: points, application_status: "Sold / Selected",
  }).eq("id", playerId);
  if (error) return { error: error.message };

  await logAudit({ action: `Assigned as ${teamRole}`, entity: "Player", entityId: playerId, field: "team_id", previousValue: "—", newValue: teamId });
  revalidatePath("/admin/players");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/squads");
  return { ok: true };
}
