import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { LightCard, LightSectionHeader, LightSeamDivider, LightStatCard } from "@/components/ui/light";
import DownloadCsv from "./DownloadCsv";

export const revalidate = 0;

const RATED: [string, string][] = [
  ["overall", "Overall"],
  ["rating_organisation", "Organisation & timings"],
  ["rating_ground", "Ground & facilities"],
  ["rating_food", "Food & hospitality"],
  ["rating_umpiring", "Umpiring & rules"],
  ["rating_live_scores", "Live scores"],
  ["auction_rating", "Auction day"],
];

function avg(rows: any[], key: string) {
  const v = rows.map((r) => r[key]).filter((x) => typeof x === "number");
  return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
}

function tally(rows: any[], key: string) {
  const m = new Map<string, number>();
  rows.forEach((r) => r[key] && m.set(r[key], (m.get(r[key]) ?? 0) + 1));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export default async function FeedbackAdminPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data } = await supabase.from("feedback_responses").select("*").order("created_at", { ascending: false });
  const rows: any[] = data ?? [];
  const comments = rows.filter((r) => r.best_part || r.improve);

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title="Season 1 Feedback" action={rows.length > 0 ? <DownloadCsv rows={rows} /> : undefined} />
      <LightSeamDivider />

      {rows.length === 0 ? (
        <LightCard className="p-8 text-center text-sm text-slateText">
          No feedback yet. Share mtccuae.com/feedback in the WhatsApp group and on Instagram.
        </LightCard>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <LightStatCard label="Responses" value={rows.length} />
            <LightStatCard label="Overall (avg)" value={(avg(rows, "overall")?.avg ?? 0).toFixed(1) + " / 5"} tone="green" />
            <LightStatCard label="Will join Season 2" value={rows.filter((r) => r.season2 && r.season2 !== "Not sure yet").length} tone="blue" />
            <LightStatCard label="Want follow-up" value={rows.filter((r) => r.name || r.phone).length} tone="orange" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <LightCard className="p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slateText mb-3">Average ratings</div>
              <div className="space-y-2">
                {RATED.map(([k, label]) => {
                  const a = avg(rows, k);
                  return (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className="w-40 text-slateText">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a ? (a.avg / 5) * 100 : 0}%`, background: "linear-gradient(90deg,#D4AF37,#F37032)" }} />
                      </div>
                      <span className="w-20 text-right font-semibold text-navyText">{a ? `${a.avg.toFixed(1)} (${a.n})` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </LightCard>

            <LightCard className="p-4">
              {[["respondent_type", "Who responded"], ["format_opinion", "5-over format"], ["season2", "Season 2"]].map(([k, label]) => (
                <div key={k} className="mb-4 last:mb-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-slateText mb-1.5">{label}</div>
                  <div className="flex flex-wrap gap-2">
                    {tally(rows, k).map(([v, n]) => (
                      <span key={v} className="text-xs px-2.5 py-1 rounded-full bg-black/5 text-navyText">{v} · <b>{n}</b></span>
                    ))}
                    {tally(rows, k).length === 0 && <span className="text-xs text-slateText">—</span>}
                  </div>
                </div>
              ))}
            </LightCard>
          </div>

          <div className="text-xs font-bold uppercase tracking-wide text-slateText mb-2">Comments ({comments.length})</div>
          <div className="space-y-2">
            {comments.map((r) => (
              <LightCard key={r.id} className="p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5 text-[11px] text-slateText">
                  <span>{r.respondent_type}{r.team_name ? ` · ${r.team_name}` : ""}{r.name ? ` · ${r.name}` : ""}{r.phone ? ` · ${r.phone}` : ""}</span>
                  <span>{"★".repeat(r.overall)} · {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}</span>
                </div>
                {r.best_part && <p className="text-sm text-navyText"><b>Best:</b> {r.best_part}</p>}
                {r.improve && <p className="text-sm text-navyText mt-1"><b>Improve:</b> {r.improve}</p>}
              </LightCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
