import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

export const revalidate = 60;

export default async function PrivacyPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("tournament_name, privacy_policy").eq("id", 1).single();

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Your Data</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Privacy Policy</h1>
        <p className="text-sm text-slateText">{settings?.tournament_name || "MTCC UAE"}</p>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10">
        {settings?.privacy_policy ? (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 sm:p-8">
            <p className="text-sm text-slateText leading-relaxed whitespace-pre-line">{settings.privacy_policy}</p>
          </div>
        ) : (
          <div className="text-sm text-slateText text-center py-12">Privacy policy will be published here soon.</div>
        )}
      </div>

      <Footer />
    </div>
  );
}
