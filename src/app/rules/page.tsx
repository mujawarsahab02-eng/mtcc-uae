import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

export const revalidate = 60;

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async function RulesPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  const sections: { title: string; text: string | undefined; numbered?: boolean }[] = [
    { title: "General Tournament Rules", text: settings?.general_rules, numbered: true },
    { title: "Player Eligibility", text: settings?.player_eligibility_rules },
    { title: "Qualification", text: settings?.qualification_rules },
    { title: "Points System", text: settings?.points_rules },
    { title: "Net Run Rate", text: settings?.nrr_rules },
    { title: "Match Conditions", text: settings?.match_conditions_rules, numbered: true },
    { title: "Tie / Super Over", text: settings?.tie_break_rules },
    { title: "Super Over Details", text: settings?.super_over_rules, numbered: true },
    { title: "Substitutions", text: settings?.substitution_rules, numbered: true },
    { title: "Terms & Conditions", text: settings?.terms_and_conditions },
  ].filter((s: { title: string; text: string | undefined; numbered?: boolean }) => s.text && s.text.trim().length > 0);

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Know The Game</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">{settings?.tournament_name || "Tournament"} Rules</h1>
        <p className="text-sm text-slateText">Please read carefully before registering or participating.</p>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        {sections.length === 0 ? (
          <div className="text-sm text-slateText text-center py-12">Rules will be published here soon.</div>
        ) : (
          <div className="md:grid md:grid-cols-[220px_1fr] gap-8">
            {/* Sticky sidebar navigation — desktop only */}
            <div className="hidden md:block">
              <div className="sticky top-24 space-y-1">
                <div className="text-[10px] uppercase tracking-wide font-bold text-slateText mb-3">On This Page</div>
                {sections.map((s) => (
                  <a key={s.title} href={`#${slugify(s.title)}`} className="block text-sm text-slateText hover:text-orange transition-colors py-1.5 border-l-2 border-transparent hover:border-orange pl-3">
                    {s.title}
                  </a>
                ))}
              </div>
            </div>

            {/* Content — accordion on all screen sizes via native <details> */}
            <div className="space-y-3">
              {sections.map((s, i) => (
                <details key={s.title} id={slugify(s.title)} open={i === 0} className="group bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden scroll-mt-24">
                  <summary className="flex items-center gap-3 p-5 cursor-pointer list-none">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}>
                      {i + 1}
                    </span>
                    <h2 className="font-display font-bold text-base text-navyText flex-1">{s.title}</h2>
                    <span className="text-slateText text-sm transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="px-5 pb-5 pl-[52px]">
                    {s.numbered ? (
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-slateText leading-relaxed">
                        {s.text!.split("\n").filter((line: string) => line.trim()).map((line: string, li: number) => (
                          <li key={li}>{line.replace(/^\d+[\.\)]\s*/, "")}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-slateText leading-relaxed whitespace-pre-line">{s.text}</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
