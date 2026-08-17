import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui";

export const revalidate = 30;

export default async function PublicSquadsPage() {
  const supabase = createClient();
  const [{ data: teams }, { data: players }] = await Promise.all([
    supabase.from("team_public").select("*"),
    supabase.from("player_public").select("*").eq("application_status", "Sold / Selected"),
  ]);

  function publicUrl(bucket: string, path: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const squadFor = (teamId: string) => (players ?? []).filter((p) => p.team_id === teamId);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">Team Squads</div>
            <div className="font-bold text-sm font-display">Maharashtra Tennis Cricket Championship UAE</div>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/standings" className="text-xs text-mutedDim underline">Standings</Link>
            <Link href="/" className="text-xs text-mutedDim underline">Home</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-8">
        <h1 className="text-2xl font-bold font-display mb-2">Meet The Teams</h1>
        <p className="text-sm text-mutedDim mb-8">Final squads, as decided in the live auction.</p>

        <div className="grid sm:grid-cols-2 gap-5">
          {(teams ?? []).map((t) => {
            const squad = squadFor(t.id);
            const logo = publicUrl("team-logos", t.logo_path);
            return (
              <div key={t.id} className="rounded-2xl border border-line bg-bgCard p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-bgCardHover border border-line flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? <img src={logo} alt={t.name} className="w-full h-full object-contain p-1" /> : <span className="text-xs font-bold text-gold">{t.name.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div>
                    <div className="font-bold font-display">{t.name}</div>
                    <div className="text-[11px] text-mutedDim">{squad.length} players</div>
                  </div>
                </div>
                {squad.length === 0 ? (
                  <div className="text-xs text-mutedDim">Squad to be finalised.</div>
                ) : (
                  <div className="space-y-1.5">
                    {squad.map((p) => (
                      <Link key={p.id} href={`/players/${p.id}`} className="flex items-center justify-between py-1.5 border-b border-line last:border-0 hover:opacity-80">
                        <span className="text-sm">{p.full_name}</span>
                        <Badge tone="default">{p.playing_role}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {(!teams || teams.length === 0) && <div className="text-sm text-mutedDim col-span-full text-center py-8">Teams will be announced soon.</div>}
        </div>
      </div>
    </div>
  );
}
