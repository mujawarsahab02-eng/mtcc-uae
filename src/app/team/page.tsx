import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { LightBadge, LightCard, LightSectionHeader, LightSeamDivider, LightStatCard } from "@/components/ui/light";
import Link from "next/link";

export const revalidate = 0;

export default async function TeamOwnerPage() {
  const profile = await requireProfile();

  if (profile.role !== "Team Owner" || !profile.team_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-adminBg">
        <LightCard className="p-8 max-w-md text-center">
          <div className="text-lg font-bold mb-2 font-display text-navyText">No Team Assigned</div>
          <p className="text-sm text-slateText">
            This page is for Team Owner accounts. Your account is signed in as {profile.role} — ask a Super Admin to
            either assign you a Team Owner role and link you to a team, or use the /admin dashboard instead.
          </p>
          <Link href="/admin" className="text-xs text-blue underline block mt-4">Go to Admin Dashboard →</Link>
        </LightCard>
      </div>
    );
  }

  const supabase = createClient();
  // RLS (is_own_team()) restricts this to exactly this owner's team and
  // squad — no other team's confidential data is reachable from here even
  // if the client requested it.
  const [{ data: team }, { data: squad }] = await Promise.all([
    supabase.from("teams").select("*").eq("id", profile.team_id).single(),
    supabase.from("player_public").select("*").eq("team_id", profile.team_id),
  ]);

  if (!team) return <div className="p-8 text-slateText bg-adminBg min-h-screen">Team not found.</div>;

  const spent = (squad ?? []).reduce((s, p: any) => s + Number(p.sold_points || 0), 0);
  const remaining = Number(team.auction_points || 0) - spent;
  const guestCount = (squad ?? []).filter((p: any) => p.category === "Guest Player").length;

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-adminBg light-form">
      <LightSectionHeader eyebrow="Team Owner Portal" title={team.name} />
      <LightSeamDivider />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
        <LightStatCard label="Auction Purse" value={team.auction_points} tone="gold" />
        <LightStatCard label="Remaining Purse" value={remaining} tone={remaining < 0 ? "red" : "green"} />
        <LightStatCard label="Players Purchased" value={squad?.length ?? 0} tone="blue" />
        <LightStatCard label="Guest Players" value={guestCount} tone="orange" />
      </div>

      <LightCard className="p-5">
        <div className="text-xs font-bold uppercase tracking-wide mb-4 text-slateText">Squad Composition</div>
        {(squad ?? []).length === 0 ? (
          <div className="text-sm text-slateText">No players purchased yet. Check back during the live auction.</div>
        ) : (
          <div className="space-y-2">
            {(squad ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 border-black/5">
                <div>
                  <span className="text-sm font-semibold text-navyText">{p.full_name}</span>
                  <span className="text-[11px] ml-2 text-slateText">{p.playing_role} · {p.category}</span>
                </div>
                <LightBadge tone="gold">{p.sold_points} pts</LightBadge>
              </div>
            ))}
          </div>
        )}
      </LightCard>

      <p className="text-[11px] text-slateText mt-4">
        Owner contact details, payment status and other teams&apos; rosters are not shown here — Team Owner accounts
        only ever see their own team, enforced at the database level.
      </p>
    </div>
  );
}
