"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const ROLES = ["Super Admin", "Tournament Admin", "Auction Admin"];

// Replace a player in a team's squad, remove one, or add one.
//  - outgoingId set  -> that player leaves the squad (marked Withdrawn)
//  - incomingId set  -> an existing unsold player joins the team
//  - newName set     -> a brand-new player is created and joins the team
export async function changeSquad(a: {
  teamId: string;
  outgoingId?: string | null;
  incomingId?: string | null;
  newName?: string | null;
  role?: string | null;
  points?: number | null;
}): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !ROLES.includes(profile.role)) return { error: "Only Super Admin, Tournament Admin or Auction Admin can change squads." };
  if (!a.teamId) return { error: "Choose a team." };
  const newName = (a.newName ?? "").trim();
  if (!a.outgoingId && !a.incomingId && !newName) return { error: "Choose who leaves or who joins." };
  if (a.incomingId && newName) return { error: "Choose an existing player or type a new name, not both." };

  const supabase = createClient();
  const { data: team } = await supabase.from("teams").select("id, name").eq("id", a.teamId).single();
  if (!team) return { error: "Team not found." };

  let outgoing: any = null;
  if (a.outgoingId) {
    const { data } = await supabase.from("players").select("id, full_name, team_id, team_role, sold_points").eq("id", a.outgoingId).single();
    outgoing = data;
    if (!outgoing || outgoing.team_id !== a.teamId) return { error: "That player is not in this team's squad." };
    if (outgoing.team_role === "Owner") return { error: "The team owner can't be removed here." };
    // Keep match records intact: a player who already played can't be taken out.
    const { count } = await supabase.from("match_players").select("id", { count: "exact", head: true }).eq("player_id", outgoing.id);
    if (count && count > 0) {
      return { error: `${outgoing.full_name} is already in the Playing XI of ${count} match${count === 1 ? "" : "es"}, so removing them would change those scorecards. Use Add player instead.` };
    }
  }

  const points = a.points ?? outgoing?.sold_points ?? 0;
  let incomingName = "";

  if (a.incomingId) {
    const { data: inc } = await supabase.from("players").select("id, full_name, team_id").eq("id", a.incomingId).single();
    if (!inc) return { error: "Player not found." };
    if (inc.team_id) return { error: `${inc.full_name} is already in a team.` };
    const { error } = await supabase.from("players").update({
      team_id: a.teamId, application_status: "Sold / Selected", sold_points: points,
    }).eq("id", inc.id);
    if (error) return { error: error.message };
    incomingName = inc.full_name;
    await logAudit({ action: "Squad: Player Joined", entity: "Player", entityId: inc.id, field: "team_id", previousValue: "—", newValue: team.name });
  } else if (newName) {
    const { data: created, error } = await supabase.from("players").insert({
      full_name: newName,
      mobile: "N/A",
      nationality: "Indian",
      playing_role: a.role || "Batsman",
      category: "Maharashtra Player",
      player_type: "Maharashtra Player",
      application_status: "Sold / Selected",
      payment_status: "Verified",
      team_role: "Auction Player",
      team_id: a.teamId,
      sold_points: points,
    }).select("id").single();
    if (error) return { error: error.message };
    incomingName = newName;
    await logAudit({ action: "Squad: New Player Added", entity: "Player", entityId: created.id, field: "full_name", previousValue: "—", newValue: `${newName} → ${team.name}` });
  }

  if (outgoing) {
    const { error } = await supabase.from("players").update({ team_id: null, application_status: "Withdrawn" }).eq("id", outgoing.id);
    if (error) return { error: `${incomingName || "The new player"} was added, but ${outgoing.full_name} could not be removed: ${error.message}` };
    await logAudit({ action: "Squad: Player Removed", entity: "Player", entityId: outgoing.id, field: "team_id", previousValue: team.name, newValue: incomingName ? `Replaced by ${incomingName}` : "Removed" });
  }

  for (const p of ["/admin/squads", "/admin/players", "/admin/teams", "/admin", "/teams", "/admin/scoring"]) revalidatePath(p);
  return { ok: true };
}
