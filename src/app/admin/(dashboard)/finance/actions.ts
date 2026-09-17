"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function requireSuperAdmin(profile: any) {
  if (!profile || profile.role !== "Super Admin") {
    return { error: "Only Super Admin can access the Finance Tracker." };
  }
  return null;
}

export async function addTransaction(entry: {
  type: string;
  category: string;
  description: string;
  amount: number;
  txn_date: string;
  payment_method: string;
  notes: string;
}): Promise<any> {
  const profile = await getCurrentProfile();
  const guard = requireSuperAdmin(profile);
  if (guard) return guard;

  if (!entry.category || !entry.amount) return { error: "Please fill in category and amount." };

  const supabase = createClient();
  const { error } = await supabase.from("transactions").insert({
    ...entry,
    recorded_by: profile.role,
    source: "manual",
  });
  if (error) return { error: error.message };

  await logAudit({ action: "Transaction Added", entity: "Finance", entityId: "transactions", field: "category", previousValue: "—", newValue: `${entry.type}: ${entry.category} (${entry.amount})` });
  revalidatePath("/admin/finance");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<any> {
  const profile = await getCurrentProfile();
  const guard = requireSuperAdmin(profile);
  if (guard) return guard;

  const supabase = createClient();
  const { data: before } = await supabase.from("transactions").select("category, amount").eq("id", id).single();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({ action: "Transaction Deleted", entity: "Finance", entityId: id, field: "category", previousValue: before ? `${before.category} (${before.amount})` : "—", newValue: "—" });
  revalidatePath("/admin/finance");
  return { ok: true };
}

export async function markTeamEntryFeePaid(teamId: string, amount: number): Promise<any> {
  const profile = await getCurrentProfile();
  const guard = requireSuperAdmin(profile);
  if (guard) return guard;

  const supabase = createClient();

  // Guard against double-counting if clicked more than once.
  const { data: existing } = await supabase.from("transactions").select("id").eq("source", "team_entry_fee").eq("source_id", teamId).maybeSingle();
  if (existing) return { error: "This team's entry fee is already marked as paid." };

  const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).single();

  const { error: updateError } = await supabase.from("teams").update({ entry_fee_status: "Paid", entry_fee_paid_date: new Date().toISOString().slice(0, 10) }).eq("id", teamId);
  if (updateError) return { error: updateError.message };

  const { error: insertError } = await supabase.from("transactions").insert({
    type: "Income",
    category: "Team Entry Fees",
    description: `Team entry fee — ${team?.name || "Unknown team"}`,
    amount,
    txn_date: new Date().toISOString().slice(0, 10),
    payment_method: "Bank Transfer",
    recorded_by: profile.role,
    source: "team_entry_fee",
    source_id: teamId,
  });
  if (insertError) return { error: insertError.message };

  await logAudit({ action: "Team Entry Fee Marked Paid", entity: "Team", entityId: teamId, field: "entry_fee_status", previousValue: "Pending", newValue: "Paid" });
  revalidatePath("/admin/finance");
  revalidatePath("/admin/teams");
  return { ok: true };
}
