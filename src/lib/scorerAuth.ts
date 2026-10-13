// Scorers sign in with a simple username. Supabase Auth needs an email, so the
// username is stored as username@<domain>. No emails are ever sent to it.
export const SCORER_EMAIL_DOMAIN = "scorers.mtcc-uae.app";

export function toLoginEmail(value: string): string {
  const v = value.trim();
  return v.includes("@") ? v : `${v.toLowerCase()}@${SCORER_EMAIL_DOMAIN}`;
}
