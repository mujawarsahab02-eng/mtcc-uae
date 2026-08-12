"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { USER_ROLES, type UserRole } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "Super Admin") return { error: "Only Super Admin can manage users and roles." } as const;
  return { profile } as const;
}

// Lists every Supabase Auth user joined with their profile (role/team).
// Uses the service role key (server-only) because listing all auth users
// isn't something the anon/authenticated RLS-scoped client can do.
export async function listUsersWithProfiles() {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard;

  const service = createServiceRoleClient();
  const { data: authUsers, error: authError } = await service.auth.admin.listUsers();
  if (authError) return { error: authError.message };

  const supabase = createClient();
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, role, team_id");
  const { data: teams } = await supabase.from("teams").select("id, name");

  const merged = authUsers.users.map((u: any) => {
    const profile = profiles?.find((p) => p.id === u.id);
    const team = teams?.find((t) => t.id === profile?.team_id);
    return { id: u.id, email: u.email, role: profile?.role ?? "Viewer", teamId: profile?.team_id ?? null, teamName: team?.name ?? null, fullName: profile?.full_name ?? null };
  });

  return { ok: true, users: merged, teams: teams ?? [] };
}

export async function inviteUser(email: string, role: UserRole, teamId: string | null) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard;
  if (!USER_ROLES.includes(role)) return { error: "Invalid role." };

  const service = createServiceRoleClient();
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/login`,
  });
  if (error) return { error: error.message };

  const supabase = createClient();
  // The on_auth_user_created trigger already created a 'Viewer' profile row;
  // update it to the intended role/team right away.
  await supabase.from("profiles").update({ role, team_id: teamId }).eq("id", data.user.id);

  await logAudit({ action: "User Invited", entity: "User", entityId: data.user.id, field: "role", previousValue: "—", newValue: role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function assignRole(userId: string, role: UserRole, teamId: string | null) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return guard;
  if (!USER_ROLES.includes(role)) return { error: "Invalid role." };

  const supabase = createClient();
  const { data: before } = await supabase.from("profiles").select("role, team_id").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ role, team_id: role === "Team Owner" ? teamId : null }).eq("id", userId);
  if (error) return { error: error.message };

  await logAudit({ action: "Role Assigned", entity: "User", entityId: userId, field: "role", previousValue: before?.role, newValue: role });
  revalidatePath("/admin/users");
  return { ok: true };
}
