import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";

export const revalidate = 60;

export default async function LandingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();
  const { data: sponsors } = await supabase.from("sponsors").select("*").order("sort_order");

  function publicUrl(bucket: string, path: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const stats = [
    { label: "Registration Fee", value: `${settings?.currency ?? "AED"} ${settings?.player_reg_fee ?? 25}` },
    { label: "Squad Size", value: `${settings?.max_squad_size ?? 14}` },
    { label: "Guest Quota", value: `${settings?.guest_quota ?? 3}` },
    { label: "Teams", value: `${settings?.number_of_teams ?? 8}` },
  ];

  return (
    <main className="min-h-screen relative overflow-hidden bg-bg">
      {/* Angled gold/orange energy band behind the hero */}
      <div
        className="absolute top-0 left-0 w-full h-[560px] -z-0"
        style={{
          background: "linear-gradient(115deg, #0A0F1C 0%, #16213D 40%, #1a2544 100%)",
          clipPath: "polygon(0 0, 100% 0, 100% 84%, 0 100%)",
        }}
      />
      <div
        className="absolute top-0 left-0 w-full h-[560px] -z-0 opacity-70"
        style={{
          background: "radial-gradient(circle at 15% 10%, rgba(212,175,55,0.25) 0%, transparent 45%), radial-gradient(circle at 85% 30%, rgba(255,122,61,0.2) 0%, transparent 40%)",
        }}
      />

      {/* Decorative cricket-ball seam watermark, top-right of hero */}
      <svg className="absolute top-4 right-[-60px] w-[420px] h-[420px] opacity-[0.08] -z-0 hidden sm:block" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="92" stroke="#D4AF37" strokeWidth="1.5" />
        <path d="M30 40 Q100 90 30 160" stroke="#D4AF37" strokeWidth="2" fill="none" />
        <path d="M170 40 Q100 90 170 160" stroke="#D4AF37" strokeWidth="2" fill="none" />
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`l-${i}`} x1={26 + i * 2.2} y1={38 + i * 8.5} x2={34 + i * 2.2} y2={38 + i * 8.5} stroke="#D4AF37" strokeWidth="1.2" />
        ))}
      </svg>

      {/* Decorative cricket stumps + bails watermark, bottom-left of hero */}
      <svg className="absolute bottom-6 left-[-30px] w-[220px] h-[260px] opacity-[0.10] -z-0 hidden sm:block" viewBox="0 0 120 160" fill="none">
        <rect x="20" y="30" width="6" height="110" fill="#FF7A3D" />
        <rect x="57" y="20" width="6" height="120" fill="#FF7A3D" />
        <rect x="94" y="30" width="6" height="110" fill="#FF7A3D" />
        <ellipse cx="38" cy="24" rx="14" ry="5" fill="#FF7A3D" />
        <ellipse cx="82" cy="18" rx="14" ry="5" fill="#FF7A3D" />
      </svg>

      {/* Warli-art-inspired geometric border band (original motif, not a reproduction of any specific artwork) */}
      <svg className="absolute top-[0px] left-0 w-full h-[18px] -z-0 opacity-40" viewBox="0 0 400 18" preserveAspectRatio="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <g key={i}>
            <polygon points={`${i * 10},18 ${i * 10 + 5},4 ${i * 10 + 10},18`} fill="none" stroke="#D4AF37" strokeWidth="0.6" />
            <circle cx={i * 10 + 5} cy="10" r="0.8" fill="#D4AF37" />
          </g>
        ))}
      </svg>

      <div
        className="absolute top-[460px] left-0 w-full h-[6px] -z-0"
        style={{ background: "linear-gradient(90deg, transparent, #D4AF37 20%, #FF7A3D 50%, #D4AF37 80%, transparent)", transform: "skewY(-2deg)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-10">
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center mb-6 border-2 border-gold bg-bgCard shadow-[0_0_40px_rgba(212,175,55,0.35)] overflow-hidden" style={{ transform: "rotate(-3deg)" }}>
          <Logo className="w-full h-full" rotate={3} />
        </div>

        <div className="text-[11px] uppercase tracking-[0.3em] font-bold mb-3 text-orange">
          {settings?.season ?? "Season 1"} · {settings?.country ?? "UAE"} · Auction-Based
        </div>
        <h1 className="text-4xl sm:text-6xl font-black font-display mb-4 max-w-3xl leading-[1.05] tracking-tight">
          {settings?.tournament_name ?? "Maharashtra Tennis Cricket Championship UAE"}
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-lg mb-10">
          {settings?.format ?? "One-Day, Tennis Cricket, Grass Ground"} — where every player earns their spot in the auction.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-14">
          <Link href="/register">
            <Button variant="primary" size="lg" className="!px-10 !py-4 !text-lg shadow-[0_8px_30px_rgba(212,175,55,0.4)]">
              Register as a Player →
            </Button>
          </Link>
          <Link href="/auction/display">
            <Button variant="ghost" size="lg" className="!px-10 !py-4 !text-lg border-2">
              ⚡ Live Auction Display
            </Button>
          </Link>
        </div>
      </div>

      {/* Bold diagonal stat strip */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 -mt-4 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="relative bg-bgCard border border-lineBright rounded-2xl p-5 sm:p-6 text-center overflow-hidden"
              style={{ transform: i % 2 === 0 ? "translateY(-6px)" : "translateY(6px)" }}
            >
              <div
                className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-20"
                style={{ background: i % 2 === 0 ? "#D4AF37" : "#FF7A3D" }}
              />
              <div className="text-3xl sm:text-4xl font-black font-display text-goldBright relative z-10">{s.value}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-mutedDim mt-1 relative z-10">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pb-6">
        <div className="rounded-2xl border border-line bg-bgCard p-6 relative overflow-hidden">
          <svg className="absolute -bottom-8 -right-8 w-32 h-32 opacity-[0.06]" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" stroke="#FF7A3D" strokeWidth="2" />
            <path d="M18 25 Q50 50 18 75" stroke="#FF7A3D" strokeWidth="2" fill="none" />
          </svg>
          <div className="text-xs uppercase font-bold tracking-wider text-orange mb-4 relative z-10">Tournament Details</div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 relative z-10">
            <Row label="Venue" value={settings?.venue || "To be announced"} />
            <Row label="Ground" value={settings?.ground_name || "To be announced"} />
            <Row label="Tournament Date" value={settings?.tournament_date || "To be announced"} />
            <Row label="Format" value={settings?.format_type || "League + Knockout"} />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center pb-12">
        <Link href="/admin/login" className="text-xs text-mutedDim underline">
          Organiser / Team Owner Sign In →
        </Link>
      </div>

      {sponsors && sponsors.filter((s) => !s.is_powered_by).length > 0 && (
        <div className="relative z-10 max-w-4xl mx-auto px-6 pb-14">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-mutedDim mb-6">Our Sponsors</div>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {sponsors.filter((s) => !s.is_powered_by).map((s) => {
              const logo = publicUrl("sponsor-logos", s.logo_path);
              const content = (
                <div className="flex flex-col items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-xl bg-bgCard border border-line flex items-center justify-center overflow-hidden">
                    {logo ? <img src={logo} alt={s.name} className="w-full h-full object-contain p-2" /> : <span className="text-[10px] text-mutedDim px-1 text-center">{s.name}</span>}
                  </div>
                  <span className="text-[11px] text-mutedDim">{s.name}</span>
                </div>
              );
              return s.website_url ? (
                <a key={s.id} href={s.website_url} target="_blank" rel="noreferrer">{content}</a>
              ) : (
                <div key={s.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}

      {sponsors && sponsors.filter((s) => s.is_powered_by).length > 0 && (
        <div className="relative z-10 flex flex-col items-center gap-3 pb-10 border-t border-line pt-8 max-w-md mx-auto">
          <span className="text-[10px] uppercase tracking-[0.25em] text-mutedDim">Powered By</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {sponsors.filter((s) => s.is_powered_by).map((s) => {
              const logo = publicUrl("sponsor-logos", s.logo_path);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  {logo && (
                    <div className="w-6 h-6 rounded-md overflow-hidden bg-bgCard border border-line flex items-center justify-center shrink-0">
                      <img src={logo} alt={s.name} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-muted">{s.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line py-2">
      <span className="text-mutedDim text-sm">{label}</span>
      <span className="text-ink font-semibold text-sm">{value}</span>
    </div>
  );
}
