import { createClient } from "@/lib/supabase/server";

// Same shape as the artifact's appendAudit(), now a real insert into the
// audit_log table (RLS-restricted: only Super Admin can read it back, see
// 0003_rls.sql). Call this from server actions after a privileged write.
export async function logAudit(params: {
  action: string;
  entity: string;
  entityId?: string | null;
  field?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  await supabase.from("audit_log").insert({
    user_id: user.id,
    role: profile?.role ?? null,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    field: params.field ?? null,
    previous_value: params.previousValue == null ? null : String(params.previousValue),
    new_value: params.newValue == null ? null : String(params.newValue),
  });
}
