import { createClient } from "@/lib/supabase/server";
import { LightSectionHeader, LightSeamDivider, LightStatCard, LightCard, LightStatusBadge } from "@/components/ui/light";

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: settings }, { data: players }, { data: teams }] = await Promise.all([
    supabase.from("tournament_settings").select("*").eq("id", 1).single(),
    supabase.from("players").select("id, full_name, player_code, application_status, payment_status, amount_paid, created_at"),
    supabase.from("teams").select("id, payment_status, amount_paid"),
  ]);

  const p = players ?? [];
  const t = teams ?? [];

  const stats = {
    total: p.length,
    feesCollected: p.reduce((s, x) => s + Number(x.amount_paid || 0), 0),
    pending: p.filter((x) => x.payment_status === "Pending").length,
    approved: p.filter((x) => x.application_status === "Approved for Auction").length,
    sold: p.filter((x) => x.application_status === "Sold / Selected").length,
    teamFees: t.reduce((s, x) => s + Number(x.amount_paid || 0), 0),
    newOrReview: p.filter((x) => x.application_status === "New" || x.application_status === "Under Review").length,
    teamsPending: t.filter((x) => x.payment_status === "Pending").length,
  };

  let daysLeft = "—";
  if (settings?.tournament_date) {
    const diff = Math.ceil((new Date(settings.tournament_date).getTime() - Date.now()) / 86400000);
    daysLeft = diff >= 0 ? `${diff} days` : "Completed";
  }

  const recent = [...p].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 6);

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow={`${settings?.country ?? "UAE"} · ${settings?.format ?? ""}`} title="Admin Dashboard" />
      <LightSeamDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
        <LightStatCard label="Teams" value={settings?.number_of_teams ?? "—"} tone="gold" />
        <LightStatCard label="Registered Players" value={stats.total} tone="blue" />
        <LightStatCard label="Approved for Auction" value={stats.approved} tone="green" />
        <LightStatCard label="Tournament Countdown" value={daysLeft} tone="orange" />
        <LightStatCard label="Player Fees Collected" value={`${settings?.currency ?? "AED"} ${stats.feesCollected}`} tone="gold" />
        <LightStatCard label="Team Fees Collected" value={`${settings?.currency ?? "AED"} ${stats.teamFees}`} tone="gold" />
        <LightStatCard label="Payments Pending" value={stats.pending} tone="red" />
        <LightStatCard label="Sold Players" value={stats.sold} tone="green" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <LightCard className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide mb-4 text-slateText">Recent Registrations</div>
          {recent.length === 0 && <div className="text-sm text-slateText">No players registered yet.</div>}
          <div className="space-y-2">
            {recent.map((pl) => (
              <div key={pl.id} className="flex items-center justify-between py-2 border-b last:border-0 border-black/5">
                <div>
                  <div className="text-sm font-semibold text-navyText">{pl.full_name || "Unnamed"}</div>
                  <div className="text-[11px] font-mono text-slateText">{pl.player_code}</div>
                </div>
                <LightStatusBadge status={pl.application_status} />
              </div>
            ))}
          </div>
        </LightCard>

        <LightCard className="p-5">
          <div className="text-xs font-bold uppercase tracking-wide mb-4 text-slateText">Pending Actions</div>
          <ul className="space-y-3 text-sm text-slateText">
            <li className="flex justify-between"><span>Players awaiting review</span><b className="text-navyText">{stats.newOrReview}</b></li>
            <li className="flex justify-between"><span>Teams with pending entry fee</span><b className="text-navyText">{stats.teamsPending}</b></li>
          </ul>
        </LightCard>
      </div>
    </div>
  );
}
