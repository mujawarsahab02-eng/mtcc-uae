import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";

export const revalidate = 30;

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: player } = await supabase.from("player_public").select("*").eq("id", params.id).single();

  if (!player) notFound();

  let teamName: string | null = null;
  if (player.team_id) {
    const { data: team } = await supabase.from("team_public").select("name, logo_path").eq("id", player.team_id).single();
    teamName = team?.name ?? null;
  }

  const photoUrl = player.photo_path
    ? supabase.storage.from("player-photos").getPublicUrl(player.photo_path).data.publicUrl
    : null;

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">Player Profile</div>
          <Link href="/squads" className="text-xs text-mutedDim underline">All Squads</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-10 text-center">
        <div className="w-32 h-32 rounded-full mx-auto mb-5 overflow-hidden border-2 border-gold bg-bgCard flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt={player.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-gold">{player.full_name?.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <h1 className="text-3xl font-bold font-display mb-2">{player.full_name}</h1>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          <Badge tone="gold">{player.playing_role}</Badge>
          {teamName && <Badge tone="blue">{teamName}</Badge>}
          {player.application_status === "Sold / Selected" && <Badge tone="green">Sold {player.sold_points ? `· ${player.sold_points} pts` : ""}</Badge>}
        </div>

        <div className="rounded-2xl border border-line bg-bgCard p-6 text-left">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row label="Playing Role" value={player.playing_role} />
            <Row label="Batting Style" value={player.batting_style} />
            <Row label="Bowling Style" value={player.bowling_style} />
            <Row label="Home District / State" value={player.district || player.state} />
            <Row label="Player Type" value={player.player_type} />
            <Row label="Category" value={player.category} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-line py-2">
      <span className="text-mutedDim">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
