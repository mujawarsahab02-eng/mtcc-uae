import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, Card } from "@/components/ui";

export default async function RegistrationSuccessPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("currency, player_reg_fee").eq("id", 1).single();

  let playerCode = "";
  if (searchParams.id) {
    const { data: player } = await supabase.from("player_public").select("player_code").eq("id", searchParams.id).single();
    playerCode = player?.player_code ?? "";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl bg-green/15 text-green">✓</div>
        <h2 className="text-xl font-bold mb-2 font-display">Registration Successful</h2>
        {playerCode && (
          <>
            <p className="text-sm mb-1 text-muted">Your Player ID</p>
            <p className="text-lg font-bold mb-4 tracking-wide font-mono text-goldBright">{playerCode}</p>
          </>
        )}
        <p className="text-sm leading-relaxed mb-2 text-muted">
          Your application will be reviewed by the tournament organising committee. Approved players will enter the official auction pool.
        </p>
        <p className="text-xs leading-relaxed mb-6 text-mutedDim">
          Registration does not guarantee selection and the {settings?.currency ?? "AED"} {settings?.player_reg_fee ?? 25} registration fee is non-refundable.
        </p>
        <Link href="/register">
          <Button variant="ghost" className="w-full">Register Another Player</Button>
        </Link>
        <Link href="/" className="text-xs mt-4 underline text-mutedDim block">Back to tournament home</Link>
      </Card>
    </div>
  );
}
