"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { setupGuestTeams } from "./actions";

// Free-flow scoring: type the team names and the players, like CricHeroes.
// Only sides that don't already have a registered team are asked for.
export default function GuestTeamSetup({ match, teamA, teamB, canScore }: { match: any; teamA: any; teamB: any; canScore: boolean }) {
  const router = useRouter();
  const [a, setA] = useState({ name: match.team_a_label || "", players: "" });
  const [b, setB] = useState({ name: match.team_b_label || "", players: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!canScore) {
    return <Card className="p-8 text-center text-sm text-mutedDim">The teams for this match haven't been set up yet.</Card>;
  }

  const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true); setErr("");
    const res: any = await setupGuestTeams(match.id, {
      a: teamA ? undefined : { name: a.name, players: lines(a.players) },
      b: teamB ? undefined : { name: b.name, players: lines(b.players) },
    });
    setBusy(false);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  const side = (label: string, team: any, st: { name: string; players: string }, set: (v: any) => void) => (
    <Card className="p-4 mb-4">
      <div className="text-xs uppercase tracking-wider text-mutedDim font-semibold mb-2">{label}</div>
      {team ? (
        <div className="text-sm font-semibold">{team.name} <span className="text-xs text-mutedDim font-normal">(registered team)</span></div>
      ) : (
        <>
          <Field label="Team name">
            <input value={st.name} placeholder="e.g. Team Falcons" onChange={(e: any) => set({ ...st, name: e.target.value })} />
          </Field>
          <Field label={`Players (one per line, ${lines(st.players).length} added)`}>
            <textarea rows={8} value={st.players} placeholder={"Player 1\nPlayer 2\nPlayer 3"} onChange={(e: any) => set({ ...st, players: e.target.value })} />
          </Field>
        </>
      )}
    </Card>
  );

  return (
    <div>
      <SectionHeader eyebrow="Match Setup" title="Teams and players" />
      <SeamDivider />
      <Card className="p-4 mb-4 text-xs text-mutedDim">
        This match has no registered teams, so type the team names and players. These guest teams stay inside this match
        and never appear in the tournament teams, players or auction. You can add more players later.
      </Card>
      {side("Team A", teamA, a, setA)}
      {side("Team B", teamB, b, setB)}
      {err && <div className="text-xs mb-3 text-red">{err}</div>}
      <Button variant="primary" className="w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save teams and continue"}</Button>
    </div>
  );
}
