import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { Card, SectionHeader, SeamDivider } from "@/components/ui";
import UsersClient from "./UsersClient";
import { listUsersWithProfiles } from "./actions";

export const revalidate = 0;

export default async function UsersPage() {
  const profile = await requireProfile();

  if (profile.role !== "Super Admin") {
    return (
      <div>
        <SectionHeader eyebrow="Admin" title="Users & Roles" />
        <SeamDivider />
        <Card className="p-8 text-center text-sm text-mutedDim">Only Super Admin can manage users and roles.</Card>
      </div>
    );
  }

  const result = await listUsersWithProfiles();
  const supabase = createClient();
  const { data: teams } = await supabase.from("teams").select("id, name").order("created_at");

  if ("error" in result) {
    return (
      <div>
        <SectionHeader eyebrow="Admin" title="Users & Roles" />
        <SeamDivider />
        <Card className="p-8 text-center text-sm text-red">{result.error}</Card>
      </div>
    );
  }

  return <UsersClient initialUsers={result.users} teams={teams ?? []} />;
}
