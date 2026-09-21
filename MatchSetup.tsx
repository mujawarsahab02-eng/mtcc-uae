"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { saveMatchSetup } from "./actions";

type Player = { id: string; full_name: string; team_id: string };
type XiRow = { player_id: string; team_id: string; is_captain: boolean; is_wicket_keeper: boolean };

function RoleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="px-2 py-1 rounded-md text-[11px] font-bold border"
      style={{ borderColor: on ? "#D4AF37" : "rgba(255,255,255,0.12)", color: on ? "#F0C94A" : "#8B98B5", background: on ? "rgba(212,175,55,0.12)" : "transparent" }}
    >
      {label}
    </button>
  );
}

// Before the first ball: overs, bowler cap, toss, CricHeroes link and both
// Playing XIs. With afterStart (Super Admin), only the Playing XIs can change.
export default function MatchSetup({ match, teamA, teamB, squadA, squadB, xiRows, settings, afterStart, onSaved, onCancel }: {
  match: any; teamA: any; teamB: any; squadA: Player[]; squadB: Player[]; xiRows: XiRow[];
  settings: { playingXI: number; oversLimit: number }; afterStart?: boolean;
  onSaved: () => void; onCancel?: () => void;
}) {
  const router = useRouter();
  const [overs, setOvers] = useState(String(match.overs_per_innings ?? settings.oversLimit));
  const [maxBowler, setMaxBowler] = useState(match.max_overs_per_bowler ? String(match.max_overs_per_bowler) : "");
  const [tossWinner, setTossWinner] = useState(match.toss_winner_id || "");
  const [tossDecision, setTossDecision] = useState(match.toss_decision || "");
  const [cricheroes, setCricheroes] = useState(match.cricheroes_url || "");
  const [picks, setPicks] = useState<Record<string, { c: boolean; wk: boolean }>>(() => {
    const init: Record<string, { c: boolean; wk: boolean }> = {};
    for (const r of xiRows) init[r.player_id] = { c: r.is_captain, wk: r.is_wicket_keeper };
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function toggle(id: string) {
    setPicks((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { c: false, wk: false };
      return next;
    });
  }

  // One captain and one wicket-keeper per team; tapping C/WK also selects the player.
  function setRole(squad: Player[], id: string, role: "c" | "wk") {
    setPicks((prev) => {
      const next = { ...prev };
      const turningOn = !next[id]?.[role];
      for (const p of squad) if (next[p.id]) next[p.id] = { ...next[p.id], [role]: false };
      next[id] = { ...(next[id] || { c: false, wk: false }), [role]: turningOn };
      return next;
    });
  }

  async function handleSave() {
    const xi = [...squadA, ...squadB]
      .filter((p) => picks[p.id])
      .map((p) => ({ playerId: p.id, teamId: p.team_id, isCaptain: picks[p.id].c, isWicketKeeper: picks[p.id].wk }));
    setBusy(true); setErr("");
    const res: any = await saveMatchSetup(match.id, {
      oversPerInnings: Number(overs),
      maxOversPerBowler: maxBowler ? Number(maxBowler) : null,
      tossWinnerId: tossWinner,
      tossDecision,
      cricheroesUrl: cricheroes,
      xi,
    });
    setBusy(false);
    if (res.error) setErr(res.error);
    else { onSaved(); router.refresh(); }
  }

  const teamList = (team: any, squad: Player[]) => {
    const count = squad.filter((p) => picks[p.id]).length;
    return (
      <Card className="p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-bold">{team.name} Playing XI</div>
          <span className="text-xs font-semibold" style={{ color: count === settings.playingXI ? "#3DDC97" : "#FF7A3D" }}>
            {count} of {settings.playingXI} selected
          </span>
        </div>
        {squad.length === 0 && <div className="text-xs text-mutedDim">No players in this squad yet.</div>}
        {squad.map((p) => {
          const sel = picks[p.id];
          return (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0">
              <label className="flex items-center gap-2 flex-1 text-sm cursor-pointer">
                <input type="checkbox" className="!w-auto" checked={!!sel} onChange={() => toggle(p.id)} />
                {p.full_name}
              </label>
              <RoleChip label="C" on={!!sel?.c} onClick={() => setRole(squad, p.id, "c")} />
              <RoleChip label="WK" on={!!sel?.wk} onClick={() => setRole(squad, p.id, "wk")} />
            </div>
          );
        })}
      </Card>
    );
  };

  return (
    <div>
      <SectionHeader eyebrow={afterStart ? "Admin" : "Match Setup"} title={afterStart ? "Edit Playing XI" : `${teamA.name} vs ${teamB.name}`} />
      <SeamDivider />
      {afterStart ? (
        <Card className="p-4 mb-4 text-xs text-mutedDim">
          The match has started, so only the Playing XIs can change. Players who have already batted or bowled must stay in.
        </Card>
      ) : (
        <Card className="p-5 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Overs per Innings">
              <input type="number" min={1} value={overs} onChange={(e: any) => setOvers(e.target.value)} />
            </Field>
            <Field label="Max Overs per Bowler">
              <input type="number" min={1} value={maxBowler} placeholder="No limit" onChange={(e: any) => setMaxBowler(e.target.value)} />
            </Field>
            <Field label="Toss Won By">
              <select value={tossWinner} onChange={(e: any) => setTossWinner(e.target.value)}>
                <option value="">Select</option>
                <option value={teamA.id}>{teamA.name}</option>
                <option value={teamB.id}>{teamB.name}</option>
              </select>
            </Field>
            <Field label="Elected To">
              <select value={tossDecision} onChange={(e: any) => setTossDecision(e.target.value)}>
                <option value="">Select</option>
                <option value="Bat">Bat first</option>
                <option value="Bowl">Bowl first</option>
              </select>
            </Field>
          </div>
          <Field label="CricHeroes Match Link (optional)">
            <input value={cricheroes} placeholder="https://cricheroes.com/..." onChange={(e: any) => setCricheroes(e.target.value)} />
          </Field>
        </Card>
      )}

      {teamList(teamA, squadA)}
      {teamList(teamB, squadB)}

      {err && <div className="text-xs mb-3 text-red">{err}</div>}
      <Button variant="primary" className="w-full" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : afterStart ? "Save Playing XI" : "Save Match Setup"}</Button>
      {onCancel && <Button variant="subtle" size="sm" className="w-full mt-2" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}
