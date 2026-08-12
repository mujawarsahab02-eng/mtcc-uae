import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, SectionHeader, SeamDivider } from "@/components/ui";

export const revalidate = 0;

export default async function AuditLogPage() {
  const profile = await requireProfile();

  if (profile.role !== "Super Admin") {
    return (
      <div>
        <SectionHeader eyebrow="Admin" title="Audit Log" />
        <SeamDivider />
        <Card className="p-8 text-center text-sm text-mutedDim">Only Super Admin can view the audit log.</Card>
      </div>
    );
  }

  const supabase = createClient();
  const { data: entries } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);

  return (
    <div>
      <SectionHeader eyebrow="Admin · Super Admin Only" title="Audit Log" />
      <SeamDivider />
      <Card className="p-3 mb-4 text-[11px] text-blue" style={{ borderColor: "rgba(78,155,255,0.25)", background: "rgba(78,155,255,0.06)" }}>
        Tracks player approvals/rejections, payment verification, category and auction-category changes, bids,
        sold/unsold outcomes, overrides, team edits, settings changes and role assignments. Backed by a real
        Postgres table with RLS restricting reads to Super Admin — this is a genuine improvement over the artifact
        prototype, though it is still only as trustworthy as the service-role/DB access surrounding it.
      </Card>
      {(entries ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-mutedDim">No audit entries yet.</Card>
      ) : (
        <div className="space-y-2">
          {(entries ?? []).map((e: any) => (
            <Card key={e.id} className="p-3">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{e.role}</Badge>
                  <span className="text-sm font-semibold">{e.action}</span>
                </div>
                <span className="text-[11px] text-mutedDim">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="text-[11px] font-mono text-mutedDim">{e.entity} · {e.entity_id} {e.field && `· ${e.field}`}</div>
              {(e.previous_value || e.new_value) && (
                <div className="text-xs mt-1">
                  <span className="text-red">{String(e.previous_value ?? "").slice(0, 60) || "—"}</span>
                  <span className="mx-1 text-mutedDim">→</span>
                  <span className="text-green">{String(e.new_value ?? "").slice(0, 60) || "—"}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
