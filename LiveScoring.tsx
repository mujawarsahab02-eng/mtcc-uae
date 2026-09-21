"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field } from "@/components/ui";
import { allowedWicketTypes, economy, formatOvers, runRate, strikeRate, SHOT_ZONES } from "@/lib/scoring";
import { recordBall, undoLastBall, setNewBowler, swapStrike, retireBatter, setInningsOvers, endInnings } from "./actions";
import { OversView, PartnershipsView, ScorecardView, ThisOverChips, type InningsView } from "./MatchTabs";

type Player = { id: string; full_name: string; team_id: string };
type Extra = null | "wide" | "no_ball" | "bye" | "leg_bye";
type Sheet = null | "wide" | "no_ball" | "bye" | "leg_bye" | "wicket" | "retire" | "bowler" | "overs" | "end";
type Tab = "Score" | "Scorecard" | "Overs" | "Partnerships";

const TONES: Record<string, { borderColor: string; color: string; background: string }> = {
  run: { borderColor: "rgba(255,255,255,0.14)", color: "#E8ECF5", background: "rgba(255,255,255,0.04)" },
  four: { borderColor: "rgba(78,155,255,0.45)", color: "#8FC0FF", background: "rgba(78,155,255,0.12)" },
  six: { borderColor: "rgba(212,175,55,0.6)", color: "#F0C94A", background: "rgba(212,175,55,0.16)" },
  extra: { borderColor: "rgba(255,122,61,0.45)", color: "#FF9A66", background: "rgba(255,122,61,0.10)" },
  wicket: { borderColor: "rgba(255,93,108,0.6)", color: "#FF6B78", background: "rgba(255,93,108,0.14)" },
};

function Pad({ label, sub, tone, onClick, disabled }: { label: string; sub?: string; tone: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="h-14 rounded-xl border font-bold flex flex-col items-center justify-center leading-none active:scale-95 transition-transform disabled:opacity-40"
      style={TONES[tone]}
    >
      <span className="text-xl">{label}</span>
      {sub && <span className="text-[10px] font-semibold mt-1 opacity-80">{sub}</span>}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      type="button" onClick={onClick}
      className="px-3 py-2 rounded-lg text-xs font-semibold border"
      style={{ borderColor: active ? "#D4AF37" : "rgba(255,255,255,0.12)", color: active ? "#F0C94A" : "#8B98B5", background: active ? "rgba(212,175,55,0.12)" : "transparent" }}
    >
      {children}
    </button>
  );
}

function SmallAction({ onClick, children, disabled }: { onClick: () => void; children: any; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex-1 py-2 rounded-lg text-xs font-semibold border border-line text-muted disabled:opacity-40">
      {children}
    </button>
  );
}

export default function LiveScoring({ match, teamA, teamB, view, views, battingSquad, bowlingSquad, maxWickets, maxBowlerOvers, playerName, canScore }: {
  match: any; teamA: any; teamB: any; view: InningsView; views: InningsView[];
  battingSquad: Player[]; bowlingSquad: Player[]; maxWickets: number; maxBowlerOvers: number | null;
  playerName: (id: string | null) => string; canScore: boolean;
}) {
  const router = useRouter();
  const { innings, balls, state, oversLimit } = view;

  const [tab, setTab] = useState<Tab>("Score");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [shotZone, setShotZone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Wicket sheet
  const [wDelivery, setWDelivery] = useState<"normal" | "wide" | "no_ball">("normal");
  const [wType, setWType] = useState("");
  const [wNonStriker, setWNonStriker] = useState(false);
  const [wFielder, setWFielder] = useState("");
  const [wRuns, setWRuns] = useState(0);
  const [wNewBatter, setWNewBatter] = useState("");
  // Retire / bowler / overs sheets
  const [rNonStriker, setRNonStriker] = useState(false);
  const [rType, setRType] = useState<"Retired Hurt" | "Retired Out">("Retired Hurt");
  const [rNewBatter, setRNewBatter] = useState("");
  const [newBowlerId, setNewBowlerId] = useState("");
  const [oversInput, setOversInput] = useState(String(oversLimit));
  const [targetInput, setTargetInput] = useState(innings.target ? String(innings.target) : "");

  const strikerId: string | null = innings.current_striker_id;
  const nonStrikerId: string | null = innings.current_non_striker_id;
  const bowlerId: string | null = innings.current_bowler_id;

  const needsNewBowler = innings.legal_balls > 0 && innings.legal_balls % 6 === 0 && bowlerId === innings.last_over_bowler_id;
  const remainingBatters = battingSquad.filter((p) => !state.batting[p.id]?.out && p.id !== strikerId && p.id !== nonStrikerId);
  const bowlerBalls = (id: string) => state.bowling[id]?.legalBalls ?? 0;
  const atBowlerCap = (id: string) => !!maxBowlerOvers && bowlerBalls(id) >= maxBowlerOvers * 6;

  const target: number | null = innings.target;
  const runsNeeded = target ? Math.max(0, target - state.totalRuns) : null;
  const ballsLeft = Math.max(0, oversLimit * 6 - state.legalBalls);
  const lastP = state.partnerships[state.partnerships.length - 1];
  const partnership = lastP && [lastP.batter1, lastP.batter2].includes(strikerId || "") && [lastP.batter1, lastP.batter2].includes(nonStrikerId || "") ? lastP : null;

  function closeSheet() {
    setSheet(null); setErr("");
    setWDelivery("normal"); setWType(""); setWNonStriker(false); setWFielder(""); setWRuns(0); setWNewBatter("");
    setRNonStriker(false); setRType("Retired Hurt"); setRNewBatter(""); setNewBowlerId("");
  }

  async function run(fn: () => Promise<any>, after?: () => void) {
    setBusy(true); setErr("");
    const res: any = await fn();
    setBusy(false);
    if (res?.error) { setErr(res.error); return false; }
    closeSheet();
    after?.();
    router.refresh();
    return true;
  }

  function payloadFor(extraType: Extra, runs: number) {
    let extraRuns = 0;
    let runsOffBat = runs;
    if (extraType === "wide") { extraRuns = 1 + runs; runsOffBat = 0; }
    else if (extraType === "bye" || extraType === "leg_bye") { extraRuns = runs; runsOffBat = 0; }
    else if (extraType === "no_ball") { extraRuns = 1; }
    return { runsOffBat, extraType, extraRuns };
  }

  function submit(extraType: Extra, runs: number) {
    if (busy) return;
    const p = payloadFor(extraType, runs);
    const zone = (extraType === null || extraType === "no_ball") && p.runsOffBat > 0 ? shotZone : null;
    return run(() => recordBall(innings.id, match.id, {
      ...p, isWicket: false, wicketType: null, dismissedPlayerId: null, fielderId: null, newBatsmanId: null, shotZone: zone,
    }), () => setShotZone(null));
  }

  // Wicket sheet
  const wExtra: Extra = wDelivery === "normal" ? null : wDelivery;
  // Retirements have their own "Retire batter" button.
  const wOptions = allowedWicketTypes(wExtra, innings.is_free_hit).filter((w) => !w.startsWith("Retired"));
  const wCounts = true;
  const wIsLastWicket = wCounts && state.totalWickets + 1 >= maxWickets;
  const wNeedsNewBatter = !wIsLastWicket && remainingBatters.length > 0;
  const wCanPickBatter = ["Run Out", "Obstructing The Field"].includes(wType);
  const wShowsFielder = ["Caught", "Run Out", "Stumped"].includes(wType);
  const wShowsRuns = ["Run Out", "Obstructing The Field"].includes(wType);

  function submitWicket() {
    if (!wType) { setErr("Choose how the batter got out."); return; }
    if (!wOptions.includes(wType)) { setErr(`${wType} isn't possible on this delivery.`); return; }
    if (wNeedsNewBatter && !wNewBatter) { setErr("Choose the incoming batter."); return; }
    const p = payloadFor(wExtra, wShowsRuns ? wRuns : 0);
    const dismissed = wCanPickBatter && wNonStriker ? nonStrikerId : strikerId;
    return run(() => recordBall(innings.id, match.id, {
      ...p, isWicket: true, wicketType: wType, dismissedPlayerId: dismissed,
      fielderId: wShowsFielder ? wFielder || null : null,
      newBatsmanId: wNeedsNewBatter ? wNewBatter : null,
      shotZone: null,
    }));
  }

  function submitRetire() {
    const playerId = rNonStriker ? nonStrikerId : strikerId;
    if (!playerId) return;
    const counts = rType === "Retired Out";
    const needsNew = !(counts && state.totalWickets + 1 >= maxWickets) && remainingBatters.length > 0;
    if (needsNew && !rNewBatter) { setErr("Choose the incoming batter."); return; }
    return run(() => retireBatter(innings.id, match.id, { playerId, type: rType, newBatsmanId: needsNew ? rNewBatter : null }));
  }

  function submitBowler() {
    if (!newBowlerId) { setErr("Choose a bowler."); return; }
    if (atBowlerCap(newBowlerId) && !window.confirm(`${playerName(newBowlerId)} has already bowled the maximum ${maxBowlerOvers} overs. Continue anyway?`)) return;
    return run(() => setNewBowler(innings.id, match.id, newBowlerId));
  }

  function submitOvers() {
    const t = innings.innings_number === 2 && targetInput ? Number(targetInput) : null;
    return run(() => setInningsOvers(innings.id, match.id, Number(oversInput), t));
  }

  const bowlerOptions = bowlingSquad.filter((p) => p.id !== innings.last_over_bowler_id && (needsNewBowler || p.id !== bowlerId));

  const header = (
    <Card className="p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-mutedDim">{view.battingName} · Innings {innings.innings_number}</div>
          <div className="text-4xl font-bold font-display text-goldBright leading-tight">{state.totalRuns}/{state.totalWickets}</div>
          <div className="text-xs text-muted">{formatOvers(state.legalBalls)} of {oversLimit} ov · CRR {runRate(state.totalRuns, state.legalBalls)}</div>
        </div>
        <div className="text-right text-xs">
          {innings.is_free_hit && <div className="font-bold text-orange mb-1">FREE HIT</div>}
          {partnership && <div className="text-mutedDim">P'ship <b className="text-ink">{partnership.runs} ({partnership.balls})</b></div>}
        </div>
      </div>
      {target && (
        <div className="text-sm text-orange font-semibold mt-2">
          Need {runsNeeded} from {ballsLeft} ball{ballsLeft === 1 ? "" : "s"} · RRR {ballsLeft ? ((runsNeeded! / ballsLeft) * 6).toFixed(2) : "-"}
        </div>
      )}
    </Card>
  );

  const crease = (
    <Card className="p-4 mb-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-mutedDim">
            <th className="text-left font-semibold pb-1">Batter</th>
            <th className="text-right font-semibold pb-1">R</th><th className="text-right font-semibold pb-1">B</th>
            <th className="text-right font-semibold pb-1">4s</th><th className="text-right font-semibold pb-1">6s</th><th className="text-right font-semibold pb-1">SR</th>
          </tr>
        </thead>
        <tbody>
          {[strikerId, nonStrikerId].filter((id): id is string => !!id).map((id) => {
            const l = state.batting[id];
            return (
              <tr key={id}>
                <td className="py-0.5">{playerName(id)}{id === strikerId ? <span className="text-goldBright"> *</span> : ""}</td>
                <td className="text-right font-bold">{l?.runs ?? 0}</td><td className="text-right text-mutedDim">{l?.balls ?? 0}</td>
                <td className="text-right text-mutedDim">{l?.fours ?? 0}</td><td className="text-right text-mutedDim">{l?.sixes ?? 0}</td>
                <td className="text-right text-mutedDim">{strikeRate(l?.runs ?? 0, l?.balls ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bowlerId && (
        <div className="flex justify-between text-sm mt-2 pt-2 border-t border-line">
          <span>{playerName(bowlerId)} <span className="text-[11px] text-mutedDim">bowling</span></span>
          <span className="text-mutedDim">
            {formatOvers(bowlerBalls(bowlerId))}{maxBowlerOvers ? `/${maxBowlerOvers}` : ""}-{state.bowling[bowlerId]?.maidens ?? 0}-{state.bowling[bowlerId]?.runsConceded ?? 0}-{state.bowling[bowlerId]?.wickets ?? 0}
            {" "}· Econ {economy(state.bowling[bowlerId]?.runsConceded ?? 0, bowlerBalls(bowlerId))}
          </span>
        </div>
      )}
      <div className="mt-3"><ThisOverChips state={state} /></div>
      {canScore && (
        <div className="flex gap-2 mt-3">
          <SmallAction onClick={() => run(() => swapStrike(innings.id, match.id))} disabled={busy}>⇄ Swap strike</SmallAction>
          <SmallAction onClick={() => { closeSheet(); setSheet("retire"); }} disabled={busy}>Retire batter</SmallAction>
          <SmallAction onClick={() => { closeSheet(); setSheet("bowler"); }} disabled={busy || needsNewBowler}>Change bowler</SmallAction>
        </div>
      )}
    </Card>
  );

  const sheetCard = (title: string, body: any) => (
    <Card className="p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-bold">{title}</div>
        <button type="button" onClick={closeSheet} className="text-xs text-mutedDim underline">Cancel</button>
      </div>
      {body}
      {err && <div className="text-xs mt-3 text-red">{err}</div>}
    </Card>
  );

  function runsRow(values: number[], onPick: (n: number) => void) {
    return (
      <div className="grid grid-cols-6 gap-2">
        {values.map((n) => <Pad key={n} label={String(n)} tone={n === 4 ? "four" : n === 6 ? "six" : "run"} onClick={() => onPick(n)} disabled={busy} />)}
      </div>
    );
  }

  let panel: any = null;
  if (sheet === "wide") panel = sheetCard("Wide. Extra runs taken by the batters?", runsRow([0, 1, 2, 3, 4], (n) => submit("wide", n)));
  else if (sheet === "no_ball") panel = sheetCard("No ball. Runs off the bat?", runsRow([0, 1, 2, 3, 4, 6], (n) => submit("no_ball", n)));
  else if (sheet === "bye") panel = sheetCard("Byes. How many?", runsRow([1, 2, 3, 4], (n) => submit("bye", n)));
  else if (sheet === "leg_bye") panel = sheetCard("Leg byes. How many?", runsRow([1, 2, 3, 4], (n) => submit("leg_bye", n)));
  else if (sheet === "wicket") panel = sheetCard("Wicket", (
    <div>
      <div className="text-[11px] text-mutedDim mb-1.5">Delivery</div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Chip active={wDelivery === "normal"} onClick={() => { setWDelivery("normal"); setWType(""); }}>Legal ball</Chip>
        <Chip active={wDelivery === "wide"} onClick={() => { setWDelivery("wide"); setWType(""); }}>Wide</Chip>
        <Chip active={wDelivery === "no_ball"} onClick={() => { setWDelivery("no_ball"); setWType(""); }}>No ball</Chip>
      </div>
      <div className="text-[11px] text-mutedDim mb-1.5">How out{innings.is_free_hit ? " (free hit: run out only)" : ""}</div>
      <div className="flex gap-2 flex-wrap mb-3">
        {wOptions.map((w) => <Chip key={w} active={wType === w} onClick={() => setWType(w)}>{w}</Chip>)}
      </div>
      {wCanPickBatter && (
        <>
          <div className="text-[11px] text-mutedDim mb-1.5">Batter out</div>
          <div className="flex gap-2 flex-wrap mb-3">
            <Chip active={!wNonStriker} onClick={() => setWNonStriker(false)}>{playerName(strikerId)} (striker)</Chip>
            <Chip active={wNonStriker} onClick={() => setWNonStriker(true)}>{playerName(nonStrikerId)}</Chip>
          </div>
        </>
      )}
      {wShowsRuns && (
        <>
          <div className="text-[11px] text-mutedDim mb-1.5">Runs completed before the run out</div>
          <div className="flex gap-2 mb-3">
            {[0, 1, 2, 3].map((n) => <Chip key={n} active={wRuns === n} onClick={() => setWRuns(n)}>{n}</Chip>)}
          </div>
        </>
      )}
      {wShowsFielder && (
        <Field label={wType === "Caught" ? "Caught by (pick the bowler for caught & bowled)" : wType === "Stumped" ? "Wicket-keeper" : "Fielder"}>
          <select value={wFielder} onChange={(e: any) => setWFielder(e.target.value)}>
            <option value="">—</option>
            {bowlingSquad.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
      )}
      {wType && wNeedsNewBatter && (
        <Field label="Incoming batter">
          <select value={wNewBatter} onChange={(e: any) => setWNewBatter(e.target.value)}>
            <option value="">Select</option>
            {remainingBatters.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
      )}
      {wType && wIsLastWicket && <div className="text-xs text-orange mb-2">This is the last wicket. The innings ends.</div>}
      <Button variant="primary" className="w-full" onClick={submitWicket} disabled={busy || !wType}>{busy ? "Saving…" : "Confirm wicket"}</Button>
    </div>
  ));
  else if (sheet === "retire") panel = sheetCard("Retire batter", (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Chip active={!rNonStriker} onClick={() => setRNonStriker(false)}>{playerName(strikerId)} (striker)</Chip>
        <Chip active={rNonStriker} onClick={() => setRNonStriker(true)}>{playerName(nonStrikerId)}</Chip>
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Chip active={rType === "Retired Hurt"} onClick={() => setRType("Retired Hurt")}>Retired hurt (can bat again)</Chip>
        <Chip active={rType === "Retired Out"} onClick={() => setRType("Retired Out")}>Retired out (counts as a wicket)</Chip>
      </div>
      {remainingBatters.length > 0 && (
        <Field label="Incoming batter">
          <select value={rNewBatter} onChange={(e: any) => setRNewBatter(e.target.value)}>
            <option value="">Select</option>
            {remainingBatters.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
      )}
      <Button variant="primary" className="w-full" onClick={submitRetire} disabled={busy}>{busy ? "Saving…" : "Confirm"}</Button>
    </div>
  ));
  else if (sheet === "bowler" || (canScore && needsNewBowler && !sheet)) panel = (
    <Card className="p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-bold">{needsNewBowler ? "Over complete. Next bowler?" : "Change bowler mid-over"}</div>
        {sheet === "bowler" && <button type="button" onClick={closeSheet} className="text-xs text-mutedDim underline">Cancel</button>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {bowlerOptions.map((p) => (
          <button key={p.id} type="button" onClick={() => setNewBowlerId(p.id)}
            className="px-3 py-2 rounded-lg text-left border text-xs"
            style={{ borderColor: newBowlerId === p.id ? "#D4AF37" : "rgba(255,255,255,0.12)", background: newBowlerId === p.id ? "rgba(212,175,55,0.12)" : "transparent" }}>
            <div className="font-semibold">{p.full_name}</div>
            <div className="text-[11px]" style={{ color: atBowlerCap(p.id) ? "#FF7A3D" : "#8B98B5" }}>
              {formatOvers(bowlerBalls(p.id))} ov{atBowlerCap(p.id) ? " · max reached" : ""}
            </div>
          </button>
        ))}
      </div>
      {err && <div className="text-xs mb-2 text-red">{err}</div>}
      <Button variant="primary" className="w-full" onClick={submitBowler} disabled={busy || !newBowlerId}>{busy ? "Saving…" : "Confirm bowler"}</Button>
      {needsNewBowler && <Button variant="subtle" size="sm" className="w-full mt-2" onClick={() => run(() => undoLastBall(innings.id, match.id))} disabled={busy}>Undo last ball</Button>}
    </Card>
  );
  else if (sheet === "overs") panel = sheetCard("Change overs (rain / bad light)", (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Overs for this innings">
          <input type="number" min={1} value={oversInput} onChange={(e: any) => setOversInput(e.target.value)} />
        </Field>
        {innings.innings_number === 2 && (
          <Field label="Revised target">
            <input type="number" min={1} value={targetInput} onChange={(e: any) => setTargetInput(e.target.value)} />
          </Field>
        )}
      </div>
      {innings.innings_number === 1 && <div className="text-[11px] text-mutedDim mb-3">Innings 2 will start with the same number of overs.</div>}
      <Button variant="primary" className="w-full" onClick={submitOvers} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </div>
  ));
  else if (sheet === "end") panel = sheetCard("End this innings now?", (
    <div>
      <div className="text-xs text-mutedDim mb-3">
        {view.battingName} finish on {state.totalRuns}/{state.totalWickets} after {formatOvers(state.legalBalls)} overs.
        {innings.innings_number === 1 ? " Innings 2 can then be started." : " The match result will be decided on these scores."} Undo reverses this.
      </div>
      <Button variant="primary" className="w-full" onClick={() => run(() => endInnings(innings.id, match.id))} disabled={busy}>{busy ? "Saving…" : "End innings"}</Button>
    </div>
  ));

  const shotRow = (
    <div className="mb-3">
      <div className="text-[11px] text-mutedDim mb-1.5">Shot direction (optional, tap before the runs)</div>
      <div className="grid grid-cols-4 gap-1.5">
        {SHOT_ZONES.map((z) => (
          <button key={z.key} type="button" onClick={() => setShotZone(shotZone === z.key ? null : z.key)}
            className="px-1 py-1.5 rounded-lg text-[11px] font-semibold border"
            style={{ borderColor: shotZone === z.key ? "#D4AF37" : "rgba(255,255,255,0.1)", color: shotZone === z.key ? "#F0C94A" : "#8B98B5", background: shotZone === z.key ? "rgba(212,175,55,0.1)" : "transparent" }}>
            {z.label}
          </button>
        ))}
      </div>
    </div>
  );

  const pad = (
    <Card className="p-4 mb-3">
      {shotRow}
      <div className="grid grid-cols-4 gap-2 mb-2">
        <Pad label="0" sub="dot" tone="run" onClick={() => submit(null, 0)} disabled={busy} />
        <Pad label="1" tone="run" onClick={() => submit(null, 1)} disabled={busy} />
        <Pad label="2" tone="run" onClick={() => submit(null, 2)} disabled={busy} />
        <Pad label="3" tone="run" onClick={() => submit(null, 3)} disabled={busy} />
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <Pad label="4" sub="FOUR" tone="four" onClick={() => submit(null, 4)} disabled={busy} />
        <Pad label="6" sub="SIX" tone="six" onClick={() => submit(null, 6)} disabled={busy} />
        <Pad label="5" tone="run" onClick={() => submit(null, 5)} disabled={busy} />
        <Pad label="W" sub="WICKET" tone="wicket" onClick={() => { closeSheet(); setSheet("wicket"); }} disabled={busy} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Pad label="WD" sub="wide" tone="extra" onClick={() => { closeSheet(); setSheet("wide"); }} disabled={busy} />
        <Pad label="NB" sub="no ball" tone="extra" onClick={() => { closeSheet(); setSheet("no_ball"); }} disabled={busy} />
        <Pad label="BYE" tone="extra" onClick={() => { closeSheet(); setSheet("bye"); }} disabled={busy} />
        <Pad label="LB" sub="leg bye" tone="extra" onClick={() => { closeSheet(); setSheet("leg_bye"); }} disabled={busy} />
      </div>
      {err && !sheet && <div className="text-xs mt-3 text-red">{err}</div>}
      <Button variant="subtle" className="w-full mt-3" onClick={() => run(() => undoLastBall(innings.id, match.id))} disabled={busy || balls.length === 0}>↶ Undo last ball</Button>
      <div className="flex gap-2 mt-2">
        <SmallAction onClick={() => { closeSheet(); setOversInput(String(oversLimit)); setTargetInput(innings.target ? String(innings.target) : ""); setSheet("overs"); }} disabled={busy}>Change overs{innings.innings_number === 2 ? " / target" : ""}</SmallAction>
        <SmallAction onClick={() => { closeSheet(); setSheet("end"); }} disabled={busy}>End innings</SmallAction>
      </div>
    </Card>
  );

  const commentary = [...balls].reverse().slice(0, 8);

  return (
    <div>
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {(["Score", "Scorecard", "Overs", "Partnerships"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ color: tab === t ? "#F0C94A" : "#8B98B5", background: tab === t ? "rgba(212,175,55,0.12)" : "transparent" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Scorecard" && <ScorecardView views={views} playerName={playerName} />}
      {tab === "Overs" && <OversView views={views} playerName={playerName} />}
      {tab === "Partnerships" && <PartnershipsView views={views} playerName={playerName} />}

      {tab === "Score" && (
        <>
          {header}
          {crease}
          {!canScore && <Card className="p-4 mb-3 text-sm text-orange">Read-only for your role.</Card>}
          {canScore && panel}
          {canScore && !panel && pad}
          {commentary.some((b: any) => b.commentary) && (
            <Card className="p-4">
              <div className="text-[11px] text-mutedDim mb-2">Commentary</div>
              {commentary.map((b: any) => (
                <div key={b.id} className="text-xs py-1.5 border-b border-line last:border-0">
                  <span className="font-semibold text-goldBright mr-2">{b.event_type ? "•" : `${b.over_number}.${b.ball_in_over}`}</span>
                  {b.commentary || "—"}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
