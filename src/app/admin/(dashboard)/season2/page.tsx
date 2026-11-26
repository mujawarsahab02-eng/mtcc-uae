import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { LightCard, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";

export const revalidate = 0;

export default async function Season2AdminPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await (supabase as any).from("season2_interest").select("*").order("created_at", { ascending: false });
  const rows: any[] = data ?? [];
  const tally = new Map<string, number>();
  rows.forEach((r) => tally.set(r.interest, (tally.get(r.interest) ?? 0) + 1));

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title="Season 2 Interest" />
      <LightSeamDivider />
      <LightCard className="p-4 mt-4 mb-4 text-sm text-navyText">
        <b>{rows.length}</b> {rows.length === 1 ? "person has" : "people have"} registered interest.
        {Array.from(tally.entries()).length > 0 && (
          <div className="mt-2 text-xs text-slateText">{Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(" · ")}</div>
        )}
      </LightCard>
      <LightCard className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slateText border-b border-black/10">
            <th className="p-3">Date</th><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Interest</th><th className="p-3">Team / company</th><th className="p-3">Message</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 align-top">
                <td className="p-3 whitespace-nowrap text-xs text-slateText">{new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })}</td>
                <td className="p-3 font-semibold text-navyText">{r.name}</td>
                <td className="p-3"><a className="underline" href={`https://wa.me/${String(r.phone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{r.phone}</a></td>
                <td className="p-3">{r.interest}</td>
                <td className="p-3">{r.organisation ?? ""}</td>
                <td className="p-3 text-xs text-slateText">{r.message ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-6 text-center text-slateText" colSpan={6}>No one yet.</td></tr>}
          </tbody>
        </table>
      </LightCard>
    </div>
  );
}
