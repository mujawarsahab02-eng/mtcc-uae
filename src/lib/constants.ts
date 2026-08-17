// Ported 1:1 from the Claude Artifact prototype's constants — same labels,
// same order, same defaults. Do not redesign.

export const PLAYING_ROLES = ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper-Batsman"] as const;
export const BATTING_STYLES = ["Right Hand", "Left Hand"] as const;
export const PLAYER_TYPES = ["Maharashtra Player", "Guest Indian Player"] as const;
export const PLAYER_CATEGORIES = [
  "Maharashtra Player",
  "Guest Player",
  "Overseas / Special Category",
  "To Be Reviewed",
] as const;
export const APPLICATION_STATUSES = [
  "New",
  "Under Review",
  "Approved for Auction",
  "Auction Pool",
  "Rejected",
  "Sold / Selected",
  "Unsold / Not Selected",
  "Withdrawn",
] as const;
export const PAYMENT_STATUSES = ["Pending", "Paid", "Verified", "Rejected"] as const;
export const TEAM_PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Verified"] as const;

export const USER_ROLES = [
  "Super Admin",
  "Tournament Admin",
  "Auction Admin",
  "Finance Admin",
  "Team Owner",
  "Scorer",
  "Viewer",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Same role gates as the artifact — now backed by real RLS as well, see
// supabase/migrations/0003_rls.sql. These arrays drive UI only; the database
// is the actual enforcement point.
export const DOCUMENT_ACCESS_ROLES: UserRole[] = ["Super Admin", "Tournament Admin", "Finance Admin"];
export const SETTINGS_EDIT_ROLES: UserRole[] = ["Super Admin", "Tournament Admin"];
export const PLAYER_DECISION_ROLES: UserRole[] = ["Super Admin", "Tournament Admin"];
export const AUCTION_ROLES: UserRole[] = ["Super Admin", "Tournament Admin", "Auction Admin"];
export const OVERRIDE_ROLES: UserRole[] = ["Super Admin"];

export const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

export function statusTone(status: string) {
  if (["Approved for Auction", "Sold / Selected", "Verified", "Paid", "Completed"].includes(status)) return "green";
  if (["Rejected", "Unsold / Not Selected", "Abandoned"].includes(status)) return "red";
  if (["Under Review", "Pending", "Auction Pool", "Partial", "Live"].includes(status)) return "gold";
  if (["Withdrawn"].includes(status)) return "default";
  return "blue";
}
