import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import FeedbackForm from "./FeedbackForm";

export const revalidate = 0;

export const metadata = { title: "Feedback | MTCC U.A.E. Season 1" };

export default async function FeedbackPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("feedback_closes_on").eq("id", 1).single();
  const { data: teams } = await supabase.from("team_public").select("name").order("name");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const closed = !!settings?.feedback_closes_on && today > settings.feedback_closes_on;

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />
      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Season 1 · Your Voice</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Share Your Feedback</h1>
        <p className="text-sm text-slateText max-w-md mx-auto">MTCC Season 1 kaisa laga? 2 minute mein bataiye, Season 2 aur behtar banayenge. 🏏</p>
      </div>
      <div className="max-w-2xl mx-auto px-5 py-10">
        <FeedbackForm teams={(teams ?? []).map((t: any) => t.name)} closed={closed} closesOn={settings?.feedback_closes_on ?? null} />
      </div>
      <Footer />
    </div>
  );
}
