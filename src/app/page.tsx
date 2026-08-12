import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, SeamDivider } from "@/components/ui";

export const revalidate = 60;

export default async function LandingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[radial-gradient(circle_at_50%_0%,#16213D_0%,#0A0F1C_60%)]">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border-2 border-gold bg-bgCard">
        <span className="font-display font-bold text-2xl text-gold">MTCC</span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-2 text-orange">
        {settings?.season ?? "Season 1"} · {settings?.country ?? "UAE"}
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3 max-w-xl">
        {settings?.tournament_name ?? "Maharashtra Tennis Cricket Championship UAE"}
      </h1>
      <p className="text-muted max-w-md mb-8">{settings?.format ?? "One-Day, Tennis Cricket, Grass Ground"} · Auction-based tournament</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <Link href="/register">
          <Button variant="primary" size="lg">
            Register as a Player
          </Button>
        </Link>
        <Link href="/auction/display">
          <Button variant="ghost" size="lg">
            Live Auction Display
          </Button>
        </Link>
      </div>

      <Card className="max-w-md w-full p-5 text-left">
        <div className="text-xs uppercase font-semibold text-muted mb-3">Key Details</div>
        <SeamDivider />
        <dl className="text-sm space-y-2 mt-3">
          <Row label="Registration Fee" value={`${settings?.currency ?? "AED"} ${settings?.player_reg_fee ?? 25}`} />
          <Row label="Squad Size" value={`${settings?.max_squad_size ?? 14} players`} />
          <Row label="Guest Player Quota" value={`${settings?.guest_quota ?? 3} per squad`} />
          <Row label="Venue" value={settings?.venue || "To be announced"} />
          <Row label="Tournament Date" value={settings?.tournament_date || "To be announced"} />
        </dl>
      </Card>

      <div className="mt-8">
        <Link href="/admin/login" className="text-xs text-mutedDim underline">
          Organiser / Team Owner Sign In →
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1.5">
      <span className="text-mutedDim">{label}</span>
      <span className="text-ink font-semibold">{value}</span>
    </div>
  );
}
