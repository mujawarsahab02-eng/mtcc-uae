import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/constants";

export async function getCurrentProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, team_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { ...profile, email: user.email } as {
    id: string;
    full_name: string | null;
    role: UserRole;
    team_id: string | null;
    email: string | undefined;
  };
}

// Call at the top of any admin/team Server Component that requires a
// specific role. Redirects to /admin/login (not signed in) or renders
// nothing further (caller should show an access-denied message) if the
// role doesn't match — RLS is still the real backstop either way.
export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/admin/login");
  return profile;
}
