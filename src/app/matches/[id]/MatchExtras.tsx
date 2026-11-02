"use client";

import type { InningsView } from "@/app/admin/(dashboard)/scoring/[matchId]/MatchTabs";
import { formatOvers, runRate } from "@/lib/scoring";

const COLORS = ["#F0C94A", "#4E9BFF"];

type Pt = { over: number; runs: number; wickets: number };

// Cumulative runs after each completed/ongoing over, starting from 0.
function series(v: InningsView): Pt[] {
  let runs = 0;
  const pts: Pt[] = [{ over: 0, runs: 0, wickets: 0 }];
  v.state.overs.forEach((o, i) => {
    runs += o.runs;
    const partial = i === v.state.overs.length - 1 && v.state.ballsInCurrentOver > 0;
    pts.push({ over: partial ? i + v.state.ballsInCurrentOver / 6 : i + 1, runs, wickets: o.wickets });
  });
  return pts;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-bgCard border border-line p-4">
      <div className="text-[10px] uppercase tracking-wider text-mutedDim mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Legend({ views }: { views: InningsView[] }) {
  return (
    <div className="flex gap-4 flex-wrap text-[11px] mb-2">
      {views.map((v, i) => (
        <span key={v.innings.id} className="flex items-center gap-1.5 text-mutedDim">
          <span className="w-3 h-1 rounded inline-block" style={{ background: COLORS[i] }} />{v.battingName}
        </span>
      ))}
    </div>
  );
}

function Worm({ views }: { views: InningsView[] }) {
  const W = 320, H = 190, L = 30, B = 22, T = 10, Rr = 8;
  const maxOver = Math.max(...views.map((v) => v.oversLimit));
  const all = views.map(series);
  const maxRuns = Math.max(10, ...all.flat().map((p) => p.runs));
  const top = Math.ceil(maxRuns / 10) * 10;
  const x = (o: number) => L + (o / maxOver) * (W - L - Rr);
  const y = (r: number) => H - B - (r / top) * (H - B - T);
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const step = maxOver > 12 ? 4 : maxOver > 6 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {gridY.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - Rr} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.08)" />
          <text x={L - 5} y={y(g) + 3} textAnchor="end" fontSize={8} fill="#8B98B5">{g}</text>
        </g>
      ))}
      {Array.from({ length: Math.floor(maxOver / step) + 1 }, (_, i) => i * step).map((o) => (
        <text key={o} x={x(o)} y={H - 6} textAnchor="middle" fontSize={8} fill="#8B98B5">{o}</text>
      ))}
      {all.map((pts, i) => (
        <g key={i}>
          <polyline points={pts.map((p) => `${x(p.over)},${y(p.runs)}`).join(" ")} fill="none" stroke={COLORS[i]} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.filter((p) => p.wickets > 0).map((p, k) => (
            <circle key={k} cx={x(p.over)} cy={y(p.runs)} r={3.4} fill="#FF5D6C" stroke="#0B1226" strokeWidth={1} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function OverBars({ views }: { views: InningsView[] }) {
  const maxOver = Math.max(...views.map((v) => v.oversLimit));
  const W = 320, H = 150, L = 22, B = 20, T = 8;
  const per = views.map((v) => v.state.overs.map((o) => o.runs));
  const top = Math.max(6, ...per.flat());
  const slot = (W - L - 6) / maxOver;
  const bw = Math.max(3, (slot - 3) / views.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, Math.round(top / 2), top].map((g) => {
        const yy = H - B - (g / top) * (H - B - T);
        return (
          <g key={g}>
            <line x1={L} x2={W - 6} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />
            <text x={L - 4} y={yy + 3} textAnchor="end" fontSize={8} fill="#8B98B5">{g}</text>
          </g>
        );
      })}
      {Array.from({ length: maxOver }, (_, o) => (
        <g key={o}>
          {per.map((arr, i) => {
            const r = arr[o];
            if (r === undefined) return null;
            const h = (r / top) * (H - B - T);
            const wk = views[i].state.overs[o]?.wickets ?? 0;
            return (
              <g key={i}>
                <rect x={L + o * slot + i * bw + 1} y={H - B - h} width={bw - 0.5} height={Math.max(h, 1)} rx={1.5} fill={COLORS[i]} opacity={0.92} />
                {wk > 0 && <circle cx={L + o * slot + i * bw + 1 + bw / 2} cy={H - B - h - 4} r={2.4} fill="#FF5D6C" />}
              </g>
            );
          })}
          <text x={L + o * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={8} fill="#8B98B5">{o + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function phases(limit: number) {
  const a = Math.max(1, Math.round(limit / 3));
  const b = Math.max(a + 1, Math.round((limit * 2) / 3));
  return [
    { name: "Powerplay", from: 0, to: a },
    { name: "Middle", from: a, to: b },
    { name: "Death", from: b, to: limit },
  ];
}

export function AnalysisView({ views }: { views: InningsView[] }) {
  const limit = Math.max(...views.map((v) => v.oversLimit));
  const ph = phases(limit);
  const rows = views.map((v) => {
    const balls = v.balls.filter((b: any) => !b.event_type);
    const legal = balls.filter((b: any) => b.extra_type !== "wide" && b.extra_type !== "no_ball");
    const dots = legal.filter((b: any) => b.runs_off_bat === 0 && !b.extra_runs).length;
    const fours = balls.filter((b: any) => b.runs_off_bat === 4).length;
    const sixes = balls.filter((b: any) => b.runs_off_bat === 6).length;
    const boundaryRuns = fours * 4 + sixes * 6;
    const extras = Object.values(v.state.extras).reduce((a: number, c: any) => a + c, 0);
    return {
      v, dots, fours, sixes, extras,
      dotPct: legal.length ? Math.round((dots / legal.length) * 100) : 0,
      boundaryPct: v.state.totalRuns ? Math.round((boundaryRuns / v.state.totalRuns) * 100) : 0,
      ph: ph.map((p) => {
        const os = v.state.overs.filter((o) => o.overNumber >= p.from && o.overNumber < p.to);
        return { runs: os.reduce((a, o) => a + o.runs, 0), wkts: os.reduce((a, o) => a + o.wickets, 0), played: os.length };
      }),
    };
  });

  return (
    <div className="space-y-3">
      <Card title="Worm · runs by over">
        <Legend views={views} />
        <Worm views={views} />
        <div className="text-[10px] text-mutedDim mt-1"><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: "#FF5D6C" }} />Wicket fell</div>
      </Card>

      <Card title="Runs per over">
        <Legend views={views} />
        <OverBars views={views} />
      </Card>

      <Card title="Phases of play">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase text-mutedDim">
              <th className="text-left font-semibold pb-1.5">Team</th>
              {ph.map((p) => (
                <th key={p.name} className="text-right font-semibold pb-1.5">{p.name}<div className="normal-case font-normal opacity-70">ov {p.from + 1}-{p.to}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.v.innings.id} className="border-t border-line">
                <td className="py-2 font-semibold" style={{ color: COLORS[i] }}>{r.v.battingName}</td>
                {r.ph.map((p, k) => (
                  <td key={k} className="py-2 text-right">{p.played ? <><b>{p.runs}</b>/{p.wkts}</> : <span className="text-mutedDim">–</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Innings comparison">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1.5 text-xs items-center">
          <div />
          {rows.map((r, i) => <div key={i} className="text-right font-bold truncate max-w-[110px]" style={{ color: COLORS[i] }}>{r.v.battingName}</div>)}
          {([
            ["Score", (r: any) => `${r.v.state.totalRuns}/${r.v.state.totalWickets}`],
            ["Overs", (r: any) => formatOvers(r.v.state.legalBalls)],
            ["Run rate", (r: any) => runRate(r.v.state.totalRuns, r.v.state.legalBalls)],
            ["Fours", (r: any) => r.fours],
            ["Sixes", (r: any) => r.sixes],
            ["Boundary runs %", (r: any) => `${r.boundaryPct}%`],
            ["Dot balls", (r: any) => `${r.dots} (${r.dotPct}%)`],
            ["Extras", (r: any) => r.extras],
          ] as [string, (r: any) => any][]).map(([label, fn]) => (
            <div key={label} className="contents">
              <div className="text-mutedDim py-1 border-t border-line">{label}</div>
              {rows.map((r, i) => <div key={i} className="text-right font-semibold py-1 border-t border-line">{fn(r)}</div>)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function TeamsView({ teams, squads, playerName }: {
  teams: { id: string; name: string }[];
  squads: Record<string, { player_id: string; is_captain: boolean; is_wicket_keeper: boolean }[]>;
  playerName: (id: string | null) => string;
}) {
  const any = teams.some((t) => (squads[t.id] ?? []).length > 0);
  if (!any) return <div className="rounded-2xl bg-bgCard border border-line p-6 text-center text-sm text-mutedDim">Playing XI will appear here once the teams are announced.</div>;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {teams.map((t) => (
        <Card key={t.id} title={`${t.name} · Playing XI`}>
          <ol className="space-y-1.5">
            {(squads[t.id] ?? []).map((p, i) => (
              <li key={p.player_id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-[11px] text-mutedDim text-right">{i + 1}</span>
                <span>{playerName(p.player_id)}</span>
                {p.is_captain && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(212,175,55,.18)", color: "#F0C94A" }}>C</span>}
                {p.is_wicket_keeper && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(78,155,255,.18)", color: "#4E9BFF" }}>WK</span>}
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

export function MatchDetailsCard({ rows }: { rows: [string, string | null | undefined][] }) {
  const shown = rows.filter(([, v]) => v);
  return (
    <Card title="Match details">
      <div className="divide-y divide-line">
        {shown.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2 text-xs">
            <span className="text-mutedDim">{k}</span>
            <span className="font-semibold text-right">{v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
