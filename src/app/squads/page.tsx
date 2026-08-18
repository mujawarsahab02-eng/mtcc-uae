import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

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
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">The Competitors</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Meet The Teams</h1>
        <p className="text-sm text-slateText">Final squads, as decided in the live auction.</p>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="grid sm:grid-cols-2 gap-6">
          {(teams ?? []).map((t) => {
            const squad = squadFor(t.id);
            const logo = publicUrl("team-logos", t.logo_path);
            return (
              <div key={t.id} className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-cream border border-black/5 flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? <img src={logo} alt={t.name} className="w-full h-full object-contain p-1.5" /> : <span className="text-sm font-bold text-orange">{t.name.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div>
                    <div className="font-bold font-display text-navyText">{t.name}</div>
                    <div className="text-[11px] text-slateText">{squad.length} players</div>
                  </div>
                </div>
                {squad.length === 0 ? (
                  <div className="text-xs text-slateText">Squad to be finalised.</div>
                ) : (
                  <div className="space-y-1.5">
                    {squad.map((p) => {
                      const photo = publicUrl("player-photos", p.photo_path);
                      return (
                        <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-3 py-2 border-b border-black/5 last:border-0 hover:bg-cream/50 rounded-lg px-1.5 -mx-1.5 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-cream border border-black/5 overflow-hidden shrink-0 flex items-center justify-center">
                            {photo ? <img src={photo} alt={p.full_name} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-orange">{p.full_name?.slice(0, 1)}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-navyText truncate">{p.full_name}</div>
                            <div className="text-[11px] text-slateText truncate">{p.playing_role}{(p.district || p.state) ? ` · ${p.district || p.state}` : ""}</div>
                          </div>
                          {p.sold_points && (
                            <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}>
                              {p.sold_points} pts
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {(!teams || teams.length === 0) && <div className="text-sm text-slateText col-span-full text-center py-8">Teams will be announced soon.</div>}
        </div>
      </div>

      <Footer />
    </div>
  );
}
