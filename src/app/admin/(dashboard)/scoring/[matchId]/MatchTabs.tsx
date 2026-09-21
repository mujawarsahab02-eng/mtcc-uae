"use client";

import { Card } from "@/components/ui";
import { describeDismissal, economy, formatOvers, strikeRate, type InningsState } from "@/lib/scoring";

export type InningsView = {
  innings: any;
  balls: any[];
  state: InningsState;
  battingName: string;
  bowlingName: string;
  oversLimit: number;
};

type NameFn = (id: string | null) => string;

const th = "py-2 px-2 text-right font-semibold";
const td = "py-2 px-2 text-right tabular-nums";

// Full batting + bowling card for each innings, Cricbuzz style.
export function ScorecardView({ views, playerName }: { views: InningsView[]; playerName: NameFn }) {
  if (!views.length) return <Card className="p-6 text-center text-sm text-mutedDim">The scorecard appears once the first ball is bowled.</Card>;
  return (
    <div className="space-y-4">
      {views.map((v) => <InningsCard key={v.innings.id} v={v} playerName={playerName} />)}
    </div>
  );
}

function InningsCard({ v, playerName }: { v: InningsView; playerName: NameFn }) {
  const s = v.state;
  const atCrease = [v.innings.current_striker_id, v.innings.current_non_striker_id];
  const extrasTotal = s.extras.wide + s.extras.no_ball + s.extras.bye + s.extras.leg_bye + s.extras.penalty;

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <div className="text-sm font-bold">{v.battingName} · Innings {v.innings.innings_number}</div>
        <div className="text-lg font-bold font-display text-goldBright">
          {s.totalRuns}/{s.totalWickets} <span className="text-xs text-mutedDim font-normal">({formatOvers(s.legalBalls)} of {v.oversLimit} ov)</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[360px]">
          <thead>
            <tr className="text-mutedDim border-b border-line">
              <th className="py-2 px-2 text-left font-semibold">Batter</th>
              <th className={th}>R</th><th className={th}>B</th><th className={th}>4s</th><th className={th}>6s</th><th className={th}>SR</th>
            </tr>
          </thead>
          <tbody>
            {s.battingOrder.map((id) => {
              const line = s.batting[id];
              const batting = v.innings.status !== "Completed" && atCrease.includes(id);
              return (
                <tr key={id} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 px-2">
                    <div className="font-semibold">{playerName(id)}{batting && id === v.innings.current_striker_id ? " *" : ""}</div>
                    <div className="text-[11px] text-mutedDim">{batting ? "batting" : describeDismissal(line, playerName)}</div>
                  </td>
                  <td className={`${td} font-bold`}>{line.runs}</td>
                  <td className={td}>{line.balls}</td>
                  <td className={td}>{line.fours}</td>
                  <td className={td}>{line.sixes}</td>
                  <td className={td}>{strikeRate(line.runs, line.balls)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-xs py-2 border-b border-line">
        <span className="text-mutedDim">Extras</span>
        <span><b>{extrasTotal}</b> <span className="text-mutedDim">(wd {s.extras.wide}, nb {s.extras.no_ball}, b {s.extras.bye}, lb {s.extras.leg_bye})</span></span>
      </div>
      <div className="flex justify-between text-sm py-2 font-bold">
        <span>Total</span>
        <span>{s.totalRuns}/{s.totalWickets} ({formatOvers(s.legalBalls)} ov, RR {economy(s.totalRuns, s.legalBalls)})</span>
      </div>

      {s.fallOfWickets.length > 0 && (
        <div className="text-[11px] text-mutedDim mb-3 leading-relaxed">
          <span className="font-semibold text-muted">Fall of wickets: </span>
          {s.fallOfWickets.map((f) => `${f.runs}-${f.wicket} (${playerName(f.playerId)}, ${formatOvers(f.legalBalls)} ov)`).join(", ")}
        </div>
      )}

      <div className="overflow-x-auto -mx-1 mt-2">
        <table className="w-full text-xs min-w-[360px]">
          <thead>
            <tr className="text-mutedDim border-b border-line">
              <th className="py-2 px-2 text-left font-semibold">Bowler</th>
              <th className={th}>O</th><th className={th}>M</th><th className={th}>R</th><th className={th}>W</th><th className={th}>Econ</th><th className={th}>0s</th><th className={th}>Wd</th><th className={th}>Nb</th>
            </tr>
          </thead>
          <tbody>
            {s.bowlingOrder.map((id) => {
              const b = s.bowling[id];
              return (
                <tr key={id} className="border-b border-line last:border-0">
                  <td className="py-2 px-2 font-semibold">{playerName(id)}</td>
                  <td className={td}>{formatOvers(b.legalBalls)}</td>
                  <td className={td}>{b.maidens}</td>
                  <td className={td}>{b.runsConceded}</td>
                  <td className={`${td} font-bold`}>{b.wickets}</td>
                  <td className={td}>{economy(b.runsConceded, b.legalBalls)}</td>
                  <td className={td}>{b.dots}</td>
                  <td className={td}>{b.wides}</td>
                  <td className={td}>{b.noBalls}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BallChip({ label, isWicket, isBoundary }: { label: string; isWicket: boolean; isBoundary: boolean }) {
  return (
    <span className="min-w-[30px] h-[30px] px-1 rounded-full inline-flex items-center justify-center text-[11px] font-bold border" style={{
      borderColor: isWicket ? "#FF5D6C" : isBoundary ? "#D4AF37" : "rgba(255,255,255,0.15)",
      color: isWicket ? "#FF5D6C" : isBoundary ? "#F0C94A" : "#C7CEDD",
      background: isWicket ? "rgba(255,93,108,0.12)" : isBoundary ? "rgba(212,175,55,0.12)" : "transparent",
    }}>{label}</span>
  );
}

export function ThisOverChips({ state }: { state: InningsState }) {
  const current = state.overs[state.overs.length - 1];
  const inProgress = current && current.overNumber === Math.floor(state.legalBalls / 6);
  if (!current || !inProgress) return <div className="text-xs text-mutedDim">New over</div>;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {current.balls.map((b, i) => <BallChip key={i} {...b} />)}
    </div>
  );
}

// Over-by-over, newest first.
export function OversView({ views, playerName }: { views: InningsView[]; playerName: NameFn }) {
  if (!views.length) return <Card className="p-6 text-center text-sm text-mutedDim">No overs bowled yet.</Card>;
  return (
    <div className="space-y-4">
      {[...views].reverse().map((v) => (
        <Card key={v.innings.id} className="p-4">
          <div className="text-sm font-bold mb-3">{v.battingName} · Innings {v.innings.innings_number}</div>
          {v.state.overs.length === 0 && <div className="text-xs text-mutedDim">No overs bowled yet.</div>}
          {[...v.state.overs].reverse().map((o) => (
            <div key={o.overNumber} className="py-2.5 border-b border-line last:border-0">
              <div className="flex justify-between items-baseline mb-1.5 gap-2">
                <div className="text-xs"><b>Over {o.overNumber + 1}</b> <span className="text-mutedDim">{playerName(o.bowlerId)}</span></div>
                <div className="text-xs text-mutedDim"><b className="text-ink">{o.runs} run{o.runs === 1 ? "" : "s"}</b>{o.wickets ? `, ${o.wickets} wkt` : ""} · {o.totalRuns}/{o.totalWickets}</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {o.balls.map((b, i) => <BallChip key={i} {...b} />)}
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

export function PartnershipsView({ views, playerName }: { views: InningsView[]; playerName: NameFn }) {
  if (!views.length) return <Card className="p-6 text-center text-sm text-mutedDim">No partnerships yet.</Card>;
  return (
    <div className="space-y-4">
      {[...views].reverse().map((v) => {
        const best = Math.max(1, ...v.state.partnerships.map((p) => p.runs));
        return (
          <Card key={v.innings.id} className="p-4">
            <div className="text-sm font-bold mb-3">{v.battingName} · Innings {v.innings.innings_number}</div>
            {v.state.partnerships.length === 0 && <div className="text-xs text-mutedDim">No partnerships yet.</div>}
            {v.state.partnerships.map((p, i) => (
              <div key={i} className="py-2.5 border-b border-line last:border-0">
                <div className="flex justify-between text-xs mb-1.5 gap-2">
                  <span>{playerName(p.batter1)} <span className="text-mutedDim">{p.b1Runs} ({p.b1Balls})</span></span>
                  <b className="text-goldBright whitespace-nowrap">{p.runs} ({p.balls})</b>
                  <span className="text-right">{playerName(p.batter2)} <span className="text-mutedDim">{p.b2Runs} ({p.b2Balls})</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.runs / best) * 100}%`, background: "#D4AF37" }} />
                </div>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}
