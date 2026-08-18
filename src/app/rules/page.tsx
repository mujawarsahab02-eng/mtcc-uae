import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 60;

export default async function RulesPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  const sections = [
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
  ].filter((s) => s.text && s.text.trim().length > 0);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">Tournament Rules</div>
          <Link href="/" className="text-xs text-mutedDim underline">Home</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-8">
        <h1 className="text-2xl font-bold font-display mb-2">{settings?.tournament_name || "Tournament"} Rules</h1>
        <p className="text-sm text-mutedDim mb-8">Please read carefully before registering or participating.</p>

        {sections.length === 0 && <div className="text-sm text-mutedDim text-center py-12">Rules will be published here soon.</div>}

        {sections.map((s) => (
          <div key={s.title} className="mb-8">
            <h2 className="text-lg font-bold font-display mb-3 pb-2 border-b border-line text-goldBright">{s.title}</h2>
            {s.numbered ? (
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted leading-relaxed">
                {s.text!.split("\n").filter((line) => line.trim()).map((line, i) => (
                  <li key={i}>{line.replace(/^\d+[\.\)]\s*/, "")}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{s.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
