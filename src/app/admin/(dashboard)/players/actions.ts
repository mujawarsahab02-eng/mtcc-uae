"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { PLAYER_DECISION_ROLES, DOCUMENT_ACCESS_ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updatePlayer(id: string, patch: Record<string, any>, action?: string) {
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
