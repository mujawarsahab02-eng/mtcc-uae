import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { LightBadge, LightCard, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";

export const revalidate = 0;

export default async function AuditLogPage() {
  const profile = await requireProfile();

  if (profile.role !== "Super Admin") {
    return (
      <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg" style={{ minHeight: "100vh" }}>
        <LightSectionHeader eyebrow="Admin" title="Audit Log" />
        <LightSeamDivider />
        <LightCard className="p-8 text-center text-sm text-slateText">Only Super Admin can view the audit log.</LightCard>
      </div>
    );
  }

  const supabase = createClient();
  const { data: entries } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin · Super Admin Only" title="Audit Log" />
      <LightSeamDivider />
      <LightCard className="p-3 mb-4 text-[11px] text-blue" style={{ borderColor: "rgba(78,155,255,0.2)", background: "rgba(78,155,255,0.05)" }}>
        Tracks player approvals/rejections, payment verification, category and auction-category changes, bids,
        sold/unsold outcomes, overrides, team edits, settings changes and role assignments. Backed by a real
        Postgres table with RLS restricting reads to Super Admin — this is a genuine improvement over the artifact
        prototype, though it is still only as trustworthy as the service-role/DB access surrounding it.
      </LightCard>
      {(entries ?? []).length === 0 ? (
        <LightCard className="p-8 text-center text-sm text-slateText">No audit entries yet.</LightCard>
      ) : (
        <div className="space-y-2">
          {(entries ?? []).map((e: any) => (
            <LightCard key={e.id} className="p-3">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <LightBadge tone="blue">{e.role}</LightBadge>
                  <span className="text-sm font-semibold text-navyText">{e.action}</span>
                </div>
                <span className="text-[11px] text-slateText">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="text-[11px] font-mono text-slateText">{e.entity} · {e.entity_id} {e.field && `· ${e.field}`}</div>
              {(e.previous_value || e.new_value) && (
                <div className="text-xs mt-1">
                  <span className="text-red">{String(e.previous_value ?? "").slice(0, 60) || "—"}</span>
                  <span className="mx-1 text-slateText">→</span>
                  <span className="text-green">{String(e.new_value ?? "").slice(0, 60) || "—"}</span>
                </div>
              )}
            </LightCard>
          ))}
        </div>
      )}
    </div>
  );
}
