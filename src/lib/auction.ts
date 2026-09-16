// Ported 1:1 from the Claude Artifact prototype's validateSale() /
// computeRemainingPoints() / computeSquad() logic. The server (via RLS +
// the auction_state row) is the source of truth; this same function also
// runs client-side before submitting a bid so the Control Room gets instant
// feedback without waiting on a round trip.

export type PlayerRow = {
  id: string;
  category: string;
  team_id: string | null;
  application_status: string;
  sold_points: number | null;
  team_role?: string | null;
};

export type TeamRow = {
  id: string;
  name: string;
  auction_points: number;
};

// A non-playing Owner (team_role === "Owner") sits outside the 14-player
// squad entirely — the team still fills a full 13 players + 1 Captain/Icon.
// Only Owner is excluded here; Captain/Icon and normal Auction Players all
// count toward the squad as usual.
export function computeSquad(team: TeamRow, players: PlayerRow[]) {
  return players.filter((p) => p.team_id === team.id && p.application_status === "Sold / Selected" && (p.team_role ?? "Auction Player") !== "Owner");
}

export function computeRemainingPoints(team: TeamRow, players: PlayerRow[]) {
  const spent = computeSquad(team, players).reduce((sum, p) => sum + Number(p.sold_points || 0), 0);
  return Number(team.auction_points || 0) - spent;
}

export function computeGuestCount(team: TeamRow, players: PlayerRow[]) {
  return computeSquad(team, players).filter((p) => p.category === "Guest Player").length;
}

export function validateSale(
  team: TeamRow,
  player: PlayerRow,
  bidAmount: number,
  players: PlayerRow[],
  settings: { maxSquadSize: number; guestQuota: number; eligibilityMode: string }
): string[] {
  const warnings: string[] = [];
  const squad = computeSquad(team, players);
  const remaining = computeRemainingPoints(team, players);

  if (squad.length >= Number(settings.maxSquadSize || 14)) {
    warnings.push(`${team.name} has already reached the maximum squad size (${settings.maxSquadSize}).`);
  }
  if (player.category === "Guest Player" && settings.eligibilityMode === "maharashtra_guest") {
    const guestCount = computeGuestCount(team, players);
    if (guestCount >= Number(settings.guestQuota || 0)) {
      warnings.push(`${team.name} has already reached its guest player quota (${settings.guestQuota}).`);
    }
  }
  if (bidAmount > remaining) {
    warnings.push(`${team.name} does not have enough auction points remaining (${remaining} left, bid is ${bidAmount}).`);
  }
  return warnings;
}
