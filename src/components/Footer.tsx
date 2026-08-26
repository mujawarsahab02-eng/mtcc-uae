import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";

export default async function Footer() {
  const supabase = createClient();
  const { data: sponsors } = await supabase.from("sponsors").select("*").eq("is_powered_by", true).order("sort_order");

  function publicUrl(bucket: string, path: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return (
    <footer style={{ background: "#0B1F3A" }} className="pt-14 pb-8">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full overflow-hidden border border-gold/60 bg-white mx-auto mb-4">
          <Logo className="w-full h-full" />
        </div>
        <div className="text-white font-display font-bold text-lg mb-1">Maharashtra Tennis Cricket Championship U.A.E.</div>
        <div className="text-goldBright text-xs uppercase tracking-[0.25em] font-semibold mb-8">One Maharashtra. One Passion. One Championship.</div>

        <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-sm">
          <Link href="/" className="text-white/70 hover:text-white transition-colors">Home</Link>
          <Link href="/register" className="text-white/70 hover:text-white transition-colors">Register</Link>
          <Link href="/squads" className="text-white/70 hover:text-white transition-colors">Squads</Link>
          <Link href="/standings" className="text-white/70 hover:text-white transition-colors">Standings</Link>
          <Link href="/rules" className="text-white/70 hover:text-white transition-colors">Rules</Link>
        </div>

        {sponsors && sponsors.length > 0 && (
          <div className="mb-8">
            <div className="text-white/50 text-[10px] uppercase tracking-[0.3em] mb-4">Powered By</div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {sponsors.map((s) => {
                const logo = publicUrl("sponsor-logos", s.logo_path);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    {logo && (
                      <div className="w-7 h-7 rounded-md overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                        <img src={logo} alt={s.name} className="w-full h-full object-contain p-0.5" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-white/80">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-white/40 text-xs border-t border-white/10 pt-6">
          <Link href="/privacy" className="hover:text-white/70 transition-colors underline">Privacy Policy</Link>
          <span className="mx-2">·</span>
          © MTCC U.A.E. — All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
