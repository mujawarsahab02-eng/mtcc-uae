"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES, DOCUMENT_ACCESS_ROLES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updateTeam(id: string, patch: Record<string, any>): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const financialFields = ["entry_fee_amount", "amount_paid", "payment_status", "payment_reference", "payment_date", "payment_receipt_path", "auction_points"];
  const touchesFinancial = Object.keys(patch).some((k) => financialFields.includes(k));
  const touchesGeneral = Object.keys(patch).some((k) => !financialFields.includes(k));

  if (touchesFinancial && !DOCUMENT_ACCESS_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin, Tournament Admin or Finance Admin can edit team financial fields." };
  }
  if (touchesGeneral && !SETTINGS_EDIT_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin or Tournament Admin can edit team profile fields." };
  }

  const supabase = createClient();
  const { data: before } = await supabase.from("teams").select("*").eq("id", id).single();
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) return { error: error.message };

  if (before) {
    for (const field of Object.keys(patch)) {
      if (JSON.stringify(before[field]) !== JSON.stringify(patch[field])) {
        await logAudit({ action: "Team Updated", entity: "Team", entityId: id, field, previousValue: before[field], newValue: patch[field] });
      }
    }
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin");
  revalidatePath("/admin/auction");
  return { ok: true };
}

// Pushes a purse value out to every existing team at once — used from the
// Settings page next to "Auction Points per Team", since changing that
// setting alone only affects teams created afterward, not existing ones.
export async function applyPurseToAllTeams(points: number): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !DOCUMENT_ACCESS_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin, Tournament Admin or Finance Admin can update team purses." };
  }
  if (!Number.isFinite(points) || points < 0) return { error: "Enter a valid purse amount first." };

  const supabase = createClient();
  const { error } = await supabase.from("teams").update({ auction_points: points }).not("id", "is", null);
  if (error) return { error: error.message };

  await logAudit({ action: "Auction Purse Applied to All Teams", entity: "Team", entityId: "all", field: "auction_points", previousValue: "varied", newValue: points });
  revalidatePath("/admin/teams");
  revalidatePath("/admin/auction");
  return { ok: true };
}
