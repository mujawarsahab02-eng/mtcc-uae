import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";

export default async function RegistrationSuccessPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("currency, player_reg_fee, whatsapp_group_link").eq("id", 1).single();

  let playerCode = "";
  if (searchParams.id) {
    const { data: player } = await supabase.from("player_public").select("player_code").eq("id", searchParams.id).single();
    playerCode = player?.player_code ?? "";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-black/5 p-8 text-center relative overflow-hidden">
        <svg className="absolute -top-10 -right-10 w-40 h-40 opacity-[0.08]" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" stroke="#D4AF37" strokeWidth="2" />
        </svg>

        <div className="w-14 h-14 rounded-full mx-auto mb-3 overflow-hidden border border-gold/50 bg-cream relative z-10">
          <Logo className="w-full h-full" />
        </div>

        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl text-white relative z-10" style={{ background: "linear-gradient(135deg, #3DDC97, #2FB57F)" }}>
          ✓
        </div>

        <h1 className="font-display font-black text-2xl text-navyText mb-2 relative z-10">You&apos;re Registered!</h1>
        <p className="text-sm text-slateText mb-5 relative z-10">Your MTCC U.A.E. player application has been received.</p>

        {playerCode && (
          <div className="rounded-xl p-4 mb-5 relative z-10" style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)" }}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slateText mb-1">Your Player ID</div>
            <div className="text-xl font-bold tracking-wide font-mono text-navyText">{playerCode}</div>
          </div>
        )}

        {settings?.whatsapp_group_link && (
          
            href={settings.whatsapp_group_link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 mb-5 px-5 py-3.5 rounded-xl text-sm font-bold text-white relative z-10 hover:-translate-y-0.5 transition-transform"
            style={{ background: "#25D366", boxShadow: "0 6px 20px rgba(37,211,102,0.3)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.79 14.16c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.97s.73-2.11.98-2.4c.26-.28.56-.35.75-.35h.53c.17 0 .4-.06.62.48.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.17-.19.7-.82.89-1.1.19-.28.38-.24.63-.14.26.09 1.66.78 1.94.93.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" /></svg>
            Join our WhatsApp Group
          </a>
        )}

        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap text-[11px] font-semibold relative z-10">
          <span className="px-3 py-1.5 rounded-full bg-cream text-navyText">Registration</span>
          <span className="text-slateText">→</span>
          <span className="px-3 py-1.5 rounded-full bg-cream text-slateText">Review</span>
          <span className="text-slateText">→</span>
          <span className="px-3 py-1.5 rounded-full bg-cream text-slateText">Auction Pool</span>
          <span className="text-slateText">→</span>
          <span className="px-3 py-1.5 rounded-full bg-cream text-slateText">Team Selection</span>
        </div>

        <p className="text-xs leading-relaxed mb-6 text-slateText relative z-10">
          Your application will be reviewed by the tournament organising committee. Approved players will enter the official auction pool. Registration does not guarantee selection, and the {settings?.currency ?? "AED"} {settings?.player_reg_fee ?? 25} registration fee is non-refundable.
        </p>

        <div className="relative z-10">
          <Link href="/register">
            <Button variant="ghost" className="w-full mb-3">Register Another Player</Button>
          </Link>
          <Link href="/" className="text-xs underline text-slateText hover:text-navyText transition-colors block">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
