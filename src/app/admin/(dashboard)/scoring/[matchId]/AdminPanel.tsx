"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { allowedWicketTypes, ballLabel } from "@/lib/scoring";
import { editBall, deleteBall, resetMatch, updateResult } from "./actions";
import MatchSetup from "./MatchSetup";
import type { InningsView } from "./MatchTabs";

type Player = { id: string; full_name: string; team_id: string };
type Kind = "normal" | "wide" | "no_ball" | "bye" | "leg_bye";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
      style={{ borderColor: active ? "#D4AF37" : "rgba(255,255,255,0.12)", color: active ? "#F0C94A" : "#8B98B5", background: active ? "rgba(212,175,55,0.12)" : "transparent" }}
    >
      {children}
    </button>
  );
}

// Super Admin only: fix any ball, change the result, edit the Playing XI
// after the start, or wipe the scoring and start again.
export default function AdminPanel({ match, teamA, teamB, views, squadA, squadB, playingA, playingB, xiRows, settings, playerName }: {
  match: any; teamA: any; teamB: any; views: InningsView[];
  squadA: Player[]; squadB: Player[]; playingA: Player[]; playingB: Player[]; xiRows: any[];
  settings: { playingXI: number; oversLimit: number }; playerName: (id: string | null) => string;
}) {
  const router = useRouter();
  const [section, setSection] = useState<"Balls" | "Result" | "Playing XI" | "Reset">("Balls");
  const [inningsIdx, setInningsIdx] = useState(Math.max(0, views.length - 1));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("normal");
  const [runs, setRuns] = useState(0);
  const [wType, setWType] = useState("");
  const [wFielder, setWFielder] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Result form
  const [resultType, setResultType] = useState<"Normal" | "Tie" | "No Result" | "Abandoned">(match.result_type === "Tie" || match.result_type === "No Result" || match.result_type === "Abandoned" ? match.result_type : match.status === "Abandoned" ? "Abandoned" : "Normal");
  const [winnerId, setWinnerId] = useState(match.winner_id || "");
  const [margin, setMargin] = useState(match.margin || "");
  const [mom, setMom] = useState(match.man_of_match_player_id || "");

  const view = views[inningsIdx];
  const balls: any[] = view?.balls ?? [];

  async function run(fn: () => Promise<any>, okMsg: string) {
    setBusy(true); setErr(""); setMsg("");
    const res: any = await fn();
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    setMsg(okMsg);
    setEditingId(null);
    router.refresh();
  }

  function startEdit(b: any) {
    const k: Kind = (b.extra_type as Kind) || "normal";
    setKind(k);
    setRuns(k === "wide" ? Math.max(0, b.extra_runs - 1) : k === "bye" || k === "leg_bye" ? b.extra_runs : b.runs_off_bat);
    setWType(b.wicket_type || "");
    setWFielder(b.fielder_id || "");
    setEditingId(b.id);
    setErr(""); setMsg("");
  }

  function saveEdit(b: any) {
    const extraType = kind === "normal" ? null : kind;
    let extraRuns = 0;
    let runsOffBat = runs;
    if (kind === "wide") { extraRuns = 1 + runs; runsOffBat = 0; }
    else if (kind === "bye" || kind === "leg_bye") { extraRuns = runs; runsOffBat = 0; }
    else if (kind === "no_ball") { extraRuns = 1; }
    return run(() => editBall(b.id, match.id, { runsOffBat, extraType, extraRuns, wicketType: b.is_wicket ? wType : null, fielderId: b.is_wicket ? wFielder || null : null }), "Ball updated. Scores rebuilt.");
  }

  function removeBall(b: any) {
    const what = b.event_type ? "this retirement" : `ball ${b.over_number}.${b.ball_in_over}`;
    if (!window.confirm(`Delete ${what}? Everything after it is re-counted. If it was a wicket, check the batters afterwards.`)) return;
    return run(() => deleteBall(b.id, match.id), "Deleted. Scores rebuilt.");
  }

  function doReset() {
    const typed = window.prompt("This deletes ALL scoring for this match (both innings, every ball) and returns it to Scheduled. Match Setup and the Playing XIs are kept.\n\nType RESET to confirm.");
    if (typed !== "RESET") return;
    return run(() => resetMatch(match.id), "Match reset.");
  }

  function saveResult() {
    return run(() => updateResult(match.id, { resultType, winnerId: winnerId || null, margin, manOfMatchPlayerId: mom || null }), "Result saved.");
  }

  const fielders = view ? (view.innings.bowling_team_id === teamA.id ? playingA : playingB) : [];
  const editingBall = balls.find((b) => b.id === editingId);

  return (
    <div>
      <SectionHeader eyebrow="Super Admin" title="Match Controls" />
      <SeamDivider />

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(["Balls", "Result", "Playing XI", "Reset"] as const).map((s) => (
          <Chip key={s} active={section === s} onClick={() => { setSection(s); setErr(""); setMsg(""); }}>{s}</Chip>
        ))}
      </div>

      {msg && <div className="text-xs mb-3 text-green">{msg}</div>}
      {err && <div className="text-xs mb-3 text-red">{err}</div>}

      {section === "Balls" && (
        <>
          {views.length > 1 && (
            <div className="flex gap-2 mb-3">
              {views.map((v, i) => (
                <Chip key={v.innings.id} active={i === inningsIdx} onClick={() => { setInningsIdx(i); setEditingId(null); }}>
                  Innings {v.innings.innings_number} ({v.battingName})
                </Chip>
              ))}
            </div>
          )}
          {balls.length === 0 && <Card className="p-6 text-center text-sm text-mutedDim">No balls recorded in this innings yet.</Card>}
          <div className="space-y-2">
            {[...balls].reverse().map((b) => (
              <Card key={b.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="text-xs font-semibold text-goldBright w-10 shrink-0 pt-0.5">{b.event_type ? "•" : `${b.over_number}.${b.ball_in_over}`}</div>
                  <div className="flex-1 text-xs">
                    <div className="mb-0.5"><b>{b.event_type ? "Retirement" : ballLabel(b)}</b> <span className="text-mutedDim">{playerName(b.bowler_id)} to {playerName(b.striker_id)}</span></div>
                    <div className="text-mutedDim">{b.commentary || "—"}</div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!b.event_type && <button type="button" className="text-xs text-goldBright underline" onClick={() => startEdit(b)}>Edit</button>}
                    <button type="button" className="text-xs text-red underline" onClick={() => removeBall(b)} disabled={busy}>Delete</button>
                  </div>
                </div>

                {editingBall && editingBall.id === b.id && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="text-[11px] text-mutedDim mb-1.5">Delivery</div>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {(["normal", "wide", "no_ball", "bye", "leg_bye"] as Kind[]).map((k) => (
                        <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                          {k === "normal" ? "Legal" : k === "no_ball" ? "No ball" : k === "leg_bye" ? "Leg bye" : k === "wide" ? "Wide" : "Bye"}
                        </Chip>
                      ))}
                    </div>
                    <div className="text-[11px] text-mutedDim mb-1.5">
                      {kind === "wide" ? "Extra runs taken (on top of the 1 wide)" : kind === "bye" || kind === "leg_bye" ? "Runs taken" : "Runs off the bat"}
                    </div>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => <Chip key={n} active={runs === n} onClick={() => setRuns(n)}>{n}</Chip>)}
                    </div>
                    {b.is_wicket && (
                      <>
                        <Field label="How out">
                          <select value={wType} onChange={(e: any) => setWType(e.target.value)}>
                            <option value="">Select</option>
                            {allowedWicketTypes(kind === "normal" ? null : kind, b.is_free_hit).map((w) => <option key={w}>{w}</option>)}
                          </select>
                        </Field>
                        {["Caught", "Run Out", "Stumped"].includes(wType) && (
                          <Field label="Fielder">
                            <select value={wFielder} onChange={(e: any) => setWFielder(e.target.value)}>
                              <option value="">—</option>
                              {fielders.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                            </select>
                          </Field>
                        )}
                        <div className="text-[11px] text-mutedDim mb-3">To add or remove a wicket, delete back to that ball and score it again.</div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => saveEdit(b)} disabled={busy}>{busy ? "Saving…" : "Save ball"}</Button>
                      <Button variant="subtle" size="sm" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {section === "Result" && (
        <Card className="p-4">
          <div className="text-[11px] text-mutedDim mb-1.5">Result</div>
          <div className="flex gap-2 flex-wrap mb-3">
            {(["Normal", "Tie", "No Result", "Abandoned"] as const).map((r) => (
              <Chip key={r} active={resultType === r} onClick={() => setResultType(r)}>{r === "Normal" ? "Win" : r}</Chip>
            ))}
          </div>
          <div className="text-[11px] text-mutedDim mb-3">
            {resultType === "Tie" || resultType === "No Result" ? "Both teams get 1 point." : resultType === "Abandoned" ? "No points to either team." : "Winner gets 2 points."}
          </div>
          {resultType === "Normal" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Winner">
                <select value={winnerId} onChange={(e: any) => setWinnerId(e.target.value)}>
                  <option value="">Select</option>
                  <option value={teamA.id}>{teamA.name}</option>
                  <option value={teamB.id}>{teamB.name}</option>
                </select>
              </Field>
              <Field label="Margin">
                <input value={margin} onChange={(e: any) => setMargin(e.target.value)} placeholder="e.g. 12 runs / 4 wickets" />
              </Field>
            </div>
          )}
          <Field label="Man of the Match">
            <select value={mom} onChange={(e: any) => setMom(e.target.value)}>
              <option value="">Not chosen yet</option>
              <optgroup label={teamA.name}>{playingA.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</optgroup>
              <optgroup label={teamB.name}>{playingB.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</optgroup>
            </select>
          </Field>
          <Button variant="primary" className="w-full" onClick={saveResult} disabled={busy}>{busy ? "Saving…" : "Save result"}</Button>
        </Card>
      )}

      {section === "Playing XI" && (
        <MatchSetup
          match={match} teamA={teamA} teamB={teamB} squadA={squadA} squadB={squadB} xiRows={xiRows} settings={settings}
          afterStart onSaved={() => { setMsg("Playing XI saved."); setSection("Balls"); }}
        />
      )}

      {section === "Reset" && (
        <Card className="p-4">
          <div className="text-sm font-bold mb-2">Reset match scoring</div>
          <div className="text-xs text-mutedDim mb-4">
            Deletes both innings and every ball, clears the result, and sets the match back to Scheduled. Match Setup and the Playing XIs stay. This can't be undone.
          </div>
          <button type="button" onClick={doReset} disabled={busy}
            className="w-full py-2.5 rounded-xl text-sm font-bold border"
            style={{ borderColor: "rgba(255,93,108,0.6)", color: "#FF6B78", background: "rgba(255,93,108,0.12)" }}>
            {busy ? "Resetting…" : "Reset match"}
          </button>
        </Card>
      )}
    </div>
  );
}
