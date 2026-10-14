import type { UserRole } from "@/lib/constants";

const STAFF: UserRole[] = ["Super Admin", "Tournament Admin", "Auction Admin", "Finance Admin"];

// Most specific prefix wins. Anything not listed is Super Admin only.
const RULES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin/scoring", roles: ["Super Admin", "Tournament Admin", "Scorer"] },
  { prefix: "/admin/fixtures", roles: ["Super Admin", "Tournament Admin", "Scorer"] },
  { prefix: "/admin/auction", roles: ["Super Admin", "Tournament Admin", "Auction Admin"] },
  { prefix: "/admin/players", roles: ["Super Admin", "Tournament Admin", "Auction Admin", "Finance Admin"] },
  { prefix: "/admin/teams", roles: ["Super Admin", "Tournament Admin", "Auction Admin", "Finance Admin"] },
  { prefix: "/admin/segregation", roles: ["Super Admin", "Tournament Admin", "Auction Admin"] },
  { prefix: "/admin/squads", roles: ["Super Admin", "Tournament Admin", "Auction Admin"] },
  { prefix: "/admin/sponsors", roles: ["Super Admin", "Tournament Admin"] },
  { prefix: "/admin/settings", roles: ["Super Admin", "Tournament Admin"] },
  { prefix: "/admin/broadcast", roles: ["Super Admin", "Tournament Admin"] },
  { prefix: "/admin/finance", roles: ["Super Admin", "Finance Admin"] },
  { prefix: "/admin/users", roles: ["Super Admin"] },
  { prefix: "/admin/audit", roles: ["Super Admin"] },
  { prefix: "/admin", roles: STAFF },
];

export function canAccess(role: UserRole, path: string): boolean {
  const clean = path.replace(/\/+$/, "") || "/";
  const rule = RULES.find((r) => clean === r.prefix || clean.startsWith(r.prefix + "/"));
  return rule ? rule.roles.includes(role) : role === "Super Admin";
}

export function homeFor(role: UserRole): string {
  return role === "Scorer" ? "/admin/fixtures" : role === "Team Owner" ? "/team" : "/";
}
