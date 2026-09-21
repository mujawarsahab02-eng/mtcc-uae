// Ported cricket scoring logic per the Laws of Cricket / standard ICC
// playing conditions. This is the single source of truth for how a ball
// affects the innings — used to compute live state AND to recompute state
// after an undo (by replaying the remaining ball log), so there's never a
// risk of the cached totals drifting from what the ball log actually says.

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty" | null;

export const WICKET_TYPES = [
  "Bowled",
  "Caught",
  "LBW",
  "Run Out",
  "Stumped",
  "Hit Wicket",
  "Obstructing The Field",
  "Timed Out",
  "Handled The Ball",
  "Hit The Ball Twice",
  "Retired Out",
  "Retired Hurt",
] as const;

// Per Law 34/35/38/etc: on an illegal delivery, only a subset of dismissals
// are available to the fielding side. Used to restrict the UI's dropdown so
// scorers can't record an impossible dismissal. On a FREE HIT the batter can
// only be out the same ways as off a no-ball (run out etc.).
export function allowedWicketTypes(extraType: ExtraType, isFreeHit: boolean = false): string[] {
  if (extraType === "no_ball" || isFreeHit) {
    return ["Run Out", "Obstructing The Field", "Handled The Ball", "Hit The Ball Twice", "Retired Hurt", "Retired Out"];
  }
  if (extraType === "wide") {
    return ["Run Out", "Stumped", "Obstructing The Field", "Handled The Ball", "Hit The Ball Twice", "Retired Hurt", "Retired Out"];
  }
  return [...WICKET_TYPES];
}

// Dismissals not credited to the bowler's wickets tally.
const NOT_BOWLER_WICKET = new Set(["Run Out", "Obstructing The Field", "Timed Out", "Handled The Ball", "Retired Out", "Retired Hurt"]);
// Dismissals that don't reduce the batting side's "wickets in hand" count.
const NON_COUNTING_WICKET = new Set(["Retired Hurt"]);

export type BallRow = {
  id?: string;
  striker_id: string;
  non_striker_id: string;
  bowler_id: string;
  runs_off_bat: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: string | null;
  dismissed_player_id: string | null;
  new_batsman_id: string | null;
  fielder_id?: string | null;
  // Non-delivery events recorded in the ball log, e.g. "retired" (a batter
  // retiring between deliveries). They never count as a ball.
  event_type?: string | null;
};

export type BattingLine = { playerId: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut: string; bowlerId: string | null; fielderId: string | null };
export type BowlingLine = { playerId: string; legalBalls: number; runsConceded: number; wickets: number; maidens: number; dots: number; wides: number; noBalls: number; fours: number; sixes: number };
export type FallOfWicket = { wicket: number; runs: number; legalBalls: number; playerId: string };
export type Partnership = { batter1: string; batter2: string; runs: number; balls: number; b1Runs: number; b1Balls: number; b2Runs: number; b2Balls: number };
export type OverSummary = { overNumber: number; bowlerId: string | null; balls: { label: string; isWicket: boolean; isBoundary: boolean }[]; runs: number; wickets: number; totalRuns: number; totalWickets: number };

export type InningsState = {
  totalRuns: number;
  totalWickets: number;
  legalBalls: number;
  extras: { wide: number; no_ball: number; bye: number; leg_bye: number; penalty: number };
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  lastOverBowler: string | null;
  isFreeHit: boolean;
  ballsInCurrentOver: number;
  battingOrder: string[];
  batting: Record<string, BattingLine>;
  bowlingOrder: string[];
  bowling: Record<string, BowlingLine>;
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
  overs: OverSummary[];
  isInningsComplete: boolean;
};

// Short label for a delivery, as shown in "this over" chips.
export function ballLabel(b: BallRow): string {
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return b.extra_runs > 1 ? `${b.extra_runs}wd` : "wd";
  if (b.extra_type === "no_ball") return b.runs_off_bat > 0 ? `${b.runs_off_bat}nb` : "nb";
  if (b.extra_type === "bye") return `${b.extra_runs}b`;
  if (b.extra_type === "leg_bye") return `${b.extra_runs}lb`;
  return String(b.runs_off_bat);
}

export function computeInningsState(
  balls: BallRow[],
  opening: { striker: string; nonStriker: string; bowler: string },
  maxWickets: number,
  maxOvers: number
): InningsState {
  let striker = opening.striker;
  let nonStriker = opening.nonStriker;
  let bowler = opening.bowler;
  let lastOverBowler: string | null = null;
  let totalRuns = 0;
  let totalWickets = 0;
  let legalBalls = 0;
  let ballsInCurrentOver = 0;
  let isFreeHit = false;
  const extras = { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0 };

  const battingOrder: string[] = [];
  const batting: Record<string, BattingLine> = {};
  const bowlingOrder: string[] = [];
  const bowling: Record<string, BowlingLine> = {};
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: Partnership[] = [];
  const overs: OverSummary[] = [];
  let overRunsForBowler = 0;
  const overBowlers = new Set<string>();

  function ensureBatter(id: string) {
    if (id && !batting[id]) {
      batting[id] = { playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: "", bowlerId: null, fielderId: null };
      battingOrder.push(id);
    }
  }
  function ensureBowler(id: string) {
    if (!bowling[id]) {
      bowling[id] = { playerId: id, legalBalls: 0, runsConceded: 0, wickets: 0, maidens: 0, dots: 0, wides: 0, noBalls: 0, fours: 0, sixes: 0 };
      bowlingOrder.push(id);
    }
  }
  // Current partnership = whoever is at the crease; a new pair starts a new one.
  function currentPartnership(): Partnership {
    const last = partnerships[partnerships.length - 1];
    const samePair = last && ((last.batter1 === striker && last.batter2 === nonStriker) || (last.batter1 === nonStriker && last.batter2 === striker));
    if (samePair) return last;
    const p: Partnership = { batter1: striker, batter2: nonStriker, runs: 0, balls: 0, b1Runs: 0, b1Balls: 0, b2Runs: 0, b2Balls: 0 };
    partnerships.push(p);
    return p;
  }

  for (const b of balls) {
    // The ball log records who was actually at the crease and bowling — the
    // scorer may have swapped strike, changed bowler mid-over or brought in a
    // new batter since the previous ball — so it is always trusted.
    if (b.striker_id) striker = b.striker_id;
    if (b.non_striker_id) nonStriker = b.non_striker_id;
    ensureBatter(striker);
    ensureBatter(nonStriker);
    // A retired-hurt batter who has come back in is batting again, not "retired".
    for (const id of [striker, nonStriker]) {
      if (batting[id] && batting[id].howOut === "Retired Hurt") batting[id].howOut = "";
    }

    if (b.event_type === "retired") {
      const id = b.dismissed_player_id || striker;
      ensureBatter(id);
      const isOut = b.wicket_type === "Retired Out";
      batting[id].howOut = b.wicket_type || "Retired Hurt";
      batting[id].out = isOut;
      if (isOut) {
        totalWickets += 1;
        fallOfWickets.push({ wicket: totalWickets, runs: totalRuns, legalBalls, playerId: id });
      }
      if (b.new_batsman_id) {
        ensureBatter(b.new_batsman_id);
        if (id === striker) striker = b.new_batsman_id;
        else if (id === nonStriker) nonStriker = b.new_batsman_id;
      }
      continue;
    }

    ensureBowler(b.bowler_id);
    const bw = bowling[b.bowler_id];
    const isLegal = b.extra_type !== "wide" && b.extra_type !== "no_ball";
    const ballRuns = b.runs_off_bat + b.extra_runs;
    totalRuns += ballRuns;

    const partnership = currentPartnership();
    partnership.runs += ballRuns;
    if (isLegal) partnership.balls += 1;
    const strikerIsB1 = partnership.batter1 === striker;

    if (b.extra_type !== "wide") {
      batting[striker].balls += 1;
      batting[striker].runs += b.runs_off_bat;
      if (b.runs_off_bat === 4) batting[striker].fours += 1;
      if (b.runs_off_bat === 6) batting[striker].sixes += 1;
      if (strikerIsB1) { partnership.b1Runs += b.runs_off_bat; partnership.b1Balls += 1; }
      else { partnership.b2Runs += b.runs_off_bat; partnership.b2Balls += 1; }
    }

    let bowlerRuns = 0;
    if (b.extra_type === "bye" || b.extra_type === "leg_bye") {
      // nothing charged to the bowler
    } else if (b.extra_type === "wide" || b.extra_type === "no_ball") {
      bowlerRuns = b.extra_runs + b.runs_off_bat;
    } else {
      bowlerRuns = b.runs_off_bat;
    }
    bw.runsConceded += bowlerRuns;
    if (b.extra_type === "wide") bw.wides += 1;
    if (b.extra_type === "no_ball") bw.noBalls += 1;
    if (b.runs_off_bat === 4) bw.fours += 1;
    if (b.runs_off_bat === 6) bw.sixes += 1;
    if (isLegal) {
      bw.legalBalls += 1;
      if (bowlerRuns === 0) bw.dots += 1;
    }
    if (b.extra_type) extras[b.extra_type] += b.extra_runs;
    overRunsForBowler += bowlerRuns;
    overBowlers.add(b.bowler_id);

    // Over-by-over summary
    const overIndex = Math.floor(legalBalls / 6);
    let over = overs[overs.length - 1];
    if (!over || over.overNumber !== overIndex) {
      over = { overNumber: overIndex, bowlerId: b.bowler_id, balls: [], runs: 0, wickets: 0, totalRuns: 0, totalWickets: 0 };
      overs.push(over);
    }
    over.bowlerId = b.bowler_id;
    over.balls.push({ label: ballLabel(b), isWicket: b.is_wicket, isBoundary: b.runs_off_bat === 4 || b.runs_off_bat === 6 });
    over.runs += ballRuns;

    let dismissedThisBall: string | null = null;
    if (b.is_wicket) {
      const dismissedId = b.dismissed_player_id || striker;
      ensureBatter(dismissedId);
      batting[dismissedId].out = !(b.wicket_type && NON_COUNTING_WICKET.has(b.wicket_type));
      batting[dismissedId].howOut = b.wicket_type || "Out";
      batting[dismissedId].bowlerId = b.wicket_type && !NOT_BOWLER_WICKET.has(b.wicket_type) ? b.bowler_id : null;
      batting[dismissedId].fielderId = b.fielder_id ?? null;

      if (!(b.wicket_type && NON_COUNTING_WICKET.has(b.wicket_type))) {
        totalWickets += 1;
        over.wickets += 1;
        dismissedThisBall = dismissedId;
      }
      if (b.wicket_type && !NOT_BOWLER_WICKET.has(b.wicket_type)) {
        bw.wickets += 1;
      }
      if (b.new_batsman_id) {
        ensureBatter(b.new_batsman_id);
        if (dismissedId === striker) striker = b.new_batsman_id;
        else if (dismissedId === nonStriker) nonStriker = b.new_batsman_id;
      }
    }

    // Strike rotates on odd runs actually run by the batters (Law 18).
    const ranRuns =
      b.extra_type === "bye" || b.extra_type === "leg_bye"
        ? b.runs_off_bat + b.extra_runs
        : b.extra_type === "wide"
        ? Math.max(0, b.extra_runs - 1)
        : b.runs_off_bat;
    if (ranRuns % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }

    isFreeHit = b.extra_type === "no_ball";

    if (isLegal) {
      legalBalls += 1;
      ballsInCurrentOver += 1;
    }
    if (dismissedThisBall) {
      fallOfWickets.push({ wicket: totalWickets, runs: totalRuns, legalBalls, playerId: dismissedThisBall });
    }
    over.totalRuns = totalRuns;
    over.totalWickets = totalWickets;

    if (isLegal && ballsInCurrentOver === 6) {
      // Maiden only if one bowler bowled the whole over without conceding.
      if (overRunsForBowler === 0 && overBowlers.size === 1) bw.maidens += 1;
      [striker, nonStriker] = [nonStriker, striker];
      lastOverBowler = b.bowler_id;
      ballsInCurrentOver = 0;
      overRunsForBowler = 0;
      overBowlers.clear();
      isFreeHit = false;
    }

    bowler = b.bowler_id;
  }

  const isInningsComplete = totalWickets >= maxWickets || legalBalls >= maxOvers * 6;

  return {
    totalRuns, totalWickets, legalBalls, extras, striker, nonStriker, bowler, lastOverBowler,
    isFreeHit, ballsInCurrentOver, battingOrder, batting, bowlingOrder, bowling,
    fallOfWickets, partnerships, overs, isInningsComplete,
  };
}

// "c Khan b Patil", "run out (Shaikh)", "not out", ...
export function describeDismissal(line: BattingLine, name: (id: string | null) => string): string {
  if (!line.howOut) return "not out";
  const bowler = line.bowlerId ? name(line.bowlerId) : "";
  const fielder = line.fielderId ? name(line.fielderId) : "";
  switch (line.howOut) {
    case "Bowled": return `b ${bowler}`;
    case "Caught": return !fielder ? `c ? b ${bowler}` : line.fielderId === line.bowlerId ? `c & b ${bowler}` : `c ${fielder} b ${bowler}`;
    case "LBW": return `lbw b ${bowler}`;
    case "Stumped": return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case "Hit Wicket": return `hit wicket b ${bowler}`;
    case "Run Out": return fielder ? `run out (${fielder})` : "run out";
    case "Retired Hurt": return "retired hurt";
    default: return line.howOut.toLowerCase();
  }
}

export function strikeRate(runs: number, balls: number): string {
  return balls ? ((runs / balls) * 100).toFixed(1) : "-";
}

export function economy(runs: number, legalBalls: number): string {
  return legalBalls ? ((runs / legalBalls) * 6).toFixed(2) : "-";
}

export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function runRate(runs: number, legalBalls: number): string {
  if (legalBalls === 0) return "0.00";
  return ((runs / legalBalls) * 6).toFixed(2);
}

// ---------------------------------------------------------------------------
// Shot directions for the wagon wheel. Coordinates are on a 0..1 field with
// the batter at the centre (0.5, 0.5) and the bowler straight up (y = 0),
// drawn for a RIGHT-handed batter (off side on the right). The public wagon
// wheel mirrors them for left-handers.
// ---------------------------------------------------------------------------
export const SHOT_ZONES = [
  { key: "third_man", label: "Third Man", x: 0.7, y: 0.846 },
  { key: "point", label: "Point", x: 0.894, y: 0.569 },
  { key: "cover", label: "Cover", x: 0.862, y: 0.331 },
  { key: "long_off", label: "Long Off", x: 0.637, y: 0.124 },
  { key: "long_on", label: "Long On", x: 0.363, y: 0.124 },
  { key: "mid_wicket", label: "Mid Wicket", x: 0.154, y: 0.3 },
  { key: "square_leg", label: "Square Leg", x: 0.106, y: 0.569 },
  { key: "fine_leg", label: "Fine Leg", x: 0.3, y: 0.846 },
] as const;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Cricbuzz-style one-line commentary, generated automatically for every ball.
export function buildCommentary(p: {
  bowler: string; batter: string; runsOffBat: number; extraType: ExtraType; extraRuns: number;
  isWicket: boolean; wicketType: string | null; dismissed: string; fielder: string | null;
  zone: string | null; isFreeHit: boolean;
}): string {
  let what: string;
  if (p.extraType === "wide") {
    what = p.extraRuns > 1 ? `wide, ${plural(p.extraRuns, "run")}` : "wide";
  } else if (p.extraType === "no_ball") {
    what = p.runsOffBat === 4 ? "no ball, FOUR" : p.runsOffBat === 6 ? "no ball, SIX" : p.runsOffBat > 0 ? `no ball, ${plural(p.runsOffBat, "run")}` : "no ball";
  } else if (p.extraType === "bye") {
    what = p.extraRuns > 0 ? plural(p.extraRuns, "bye") : "no run";
  } else if (p.extraType === "leg_bye") {
    what = p.extraRuns > 0 ? plural(p.extraRuns, "leg bye") : "no run";
  } else if (p.runsOffBat === 4) {
    what = "FOUR";
  } else if (p.runsOffBat === 6) {
    what = "SIX";
  } else if (p.runsOffBat === 0) {
    what = "no run";
  } else {
    what = plural(p.runsOffBat, "run");
  }

  let text = `${p.bowler} to ${p.batter}, ${what}`;
  if (p.zone && p.runsOffBat > 0) text += `, towards ${p.zone.toLowerCase()}`;

  if (p.isWicket && p.wicketType) {
    if (p.wicketType === "Retired Hurt") {
      text += `. ${p.dismissed} retires hurt`;
    } else {
      let how: string;
      switch (p.wicketType) {
        case "Bowled": how = `b ${p.bowler}`; break;
        case "Caught": how = !p.fielder ? `caught b ${p.bowler}` : p.fielder === p.bowler ? `c & b ${p.bowler}` : `c ${p.fielder} b ${p.bowler}`; break;
        case "LBW": how = `lbw b ${p.bowler}`; break;
        case "Stumped": how = p.fielder ? `st ${p.fielder} b ${p.bowler}` : `st b ${p.bowler}`; break;
        case "Run Out": how = p.fielder ? `run out (${p.fielder})` : "run out"; break;
        case "Hit Wicket": how = `hit wicket b ${p.bowler}`; break;
        default: how = p.wicketType.toLowerCase();
      }
      text += `. OUT! ${p.dismissed} ${how}`;
    }
  }

  return p.isFreeHit ? `FREE HIT: ${text}` : text;
}
