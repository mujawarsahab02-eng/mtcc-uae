import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";

export const revalidate = 60;

export default async function LandingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

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
        className="absolute top-0 left-0 w-full h-[520px] -z-0"
        style={{
          background: "linear-gradient(115deg, #0A0F1C 0%, #16213D 40%, #1a2544 100%)",
          clipPath: "polygon(0 0, 100% 0, 100% 82%, 0 100%)",
        }}
      />
      <div
        className="absolute top-0 left-0 w-full h-[520px] -z-0 opacity-70"
        style={{
          background: "radial-gradient(circle at 15% 10%, rgba(212,175,55,0.25) 0%, transparent 45%), radial-gradient(circle at 85% 30%, rgba(255,122,61,0.2) 0%, transparent 40%)",
        }}
      />
      <div
        className="absolute top-[420px] left-0 w-full h-[6px] -z-0"
        style={{ background: "linear-gradient(90deg, transparent, #D4AF37 20%, #FF7A3D 50%, #D4AF37 80%, transparent)", transform: "skewY(-2deg)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-10">
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center mb-6 border-2 border-gold bg-bgCard shadow-[0_0_40px_rgba(212,175,55,0.35)] overflow-hidden" style={{ transform: "rotate(-3deg)" }}>
          <img src="/logo.png" alt="MTCC UAE" className="w-full h-full object-contain p-2" style={{ transform: "rotate(3deg)" }} />
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
        <div className="rounded-2xl border border-line bg-bgCard p-6">
          <div className="text-xs uppercase font-bold tracking-wider text-orange mb-4">Tournament Details</div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
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
