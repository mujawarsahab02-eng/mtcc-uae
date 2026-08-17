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
// scorers can't record an impossible dismissal.
export function allowedWicketTypes(extraType: ExtraType): string[] {
  if (extraType === "no_ball") {
    return ["Run Out", "Obstructing The Field", "Handled The Ball", "Hit The Ball Twice"];
  }
  if (extraType === "wide") {
    return ["Run Out", "Stumped", "Obstructing The Field", "Handled The Ball", "Hit The Ball Twice"];
  }
  return [...WICKET_TYPES];
}

// Dismissals not credited to the bowler's wickets tally.
const NOT_BOWLER_WICKET = new Set(["Run Out", "Obstructing The Field", "Timed Out", "Handled The Ball", "Retired Out", "Retired Hurt"]);
// Dismissals that don't reduce the batting side's "wickets in hand" count
// (the batter can, in principle, resume — V1 doesn't model the resumption).
const NON_COUNTING_WICKET = new Set(["Retired Hurt"]);

export type BallRow = {
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
};

export type BattingLine = { playerId: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut: string; bowlerId: string | null; fielderId: string | null };
export type BowlingLine = { playerId: string; legalBalls: number; runsConceded: number; wickets: number };

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
  isInningsComplete: boolean;
};

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

  function ensureBatter(id: string) {
    if (!batting[id]) {
      batting[id] = { playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: "", bowlerId: null, fielderId: null };
      battingOrder.push(id);
    }
  }
  function ensureBowler(id: string) {
    if (!bowling[id]) {
      bowling[id] = { playerId: id, legalBalls: 0, runsConceded: 0, wickets: 0 };
      bowlingOrder.push(id);
    }
  }

  for (const b of balls) {
    ensureBatter(b.striker_id);
    ensureBatter(b.non_striker_id);
    ensureBowler(b.bowler_id);

    const isLegal = b.extra_type !== "wide" && b.extra_type !== "no_ball";
    totalRuns += b.runs_off_bat + b.extra_runs;

    if (b.extra_type !== "wide") {
      batting[b.striker_id].balls += 1;
      batting[b.striker_id].runs += b.runs_off_bat;
      if (b.runs_off_bat === 4) batting[b.striker_id].fours += 1;
      if (b.runs_off_bat === 6) batting[b.striker_id].sixes += 1;
    }

    if (b.extra_type === "bye" || b.extra_type === "leg_bye") {
      // nothing charged to the bowler
    } else if (b.extra_type === "wide" || b.extra_type === "no_ball") {
      bowling[b.bowler_id].runsConceded += b.extra_runs + b.runs_off_bat;
    } else {
      bowling[b.bowler_id].runsConceded += b.runs_off_bat;
    }
    if (isLegal) bowling[b.bowler_id].legalBalls += 1;
    if (b.extra_type) extras[b.extra_type] += b.extra_runs;

    if (b.is_wicket) {
      const dismissedId = b.dismissed_player_id || b.striker_id;
      ensureBatter(dismissedId);
      batting[dismissedId].out = true;
      batting[dismissedId].howOut = b.wicket_type || "Out";
      batting[dismissedId].bowlerId = b.wicket_type && !NOT_BOWLER_WICKET.has(b.wicket_type) ? b.bowler_id : null;

      if (!(b.wicket_type && NON_COUNTING_WICKET.has(b.wicket_type))) {
        totalWickets += 1;
      }
      if (b.wicket_type && !NOT_BOWLER_WICKET.has(b.wicket_type)) {
        bowling[b.bowler_id].wickets += 1;
      }
      if (b.new_batsman_id) {
        ensureBatter(b.new_batsman_id);
        if (dismissedId === striker) striker = b.new_batsman_id;
        else if (dismissedId === nonStriker) nonStriker = b.new_batsman_id;
      }
    }

    // Strike rotates on odd runs actually run by the batsmen — this
    // includes byes/leg-byes and any runs taken off a wide/no-ball beyond
    // the automatic penalty, per Law 18.
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
      if (ballsInCurrentOver === 6) {
        [striker, nonStriker] = [nonStriker, striker];
        lastOverBowler = b.bowler_id;
        ballsInCurrentOver = 0;
        isFreeHit = false;
      }
    }

    bowler = b.bowler_id;
  }

  const isInningsComplete = totalWickets >= maxWickets || legalBalls >= maxOvers * 6;

  return {
    totalRuns, totalWickets, legalBalls, extras, striker, nonStriker, bowler, lastOverBowler,
    isFreeHit, ballsInCurrentOver, battingOrder, batting, bowlingOrder, bowling, isInningsComplete,
  };
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
