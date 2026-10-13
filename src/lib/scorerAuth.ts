// Accounts sign in with an email, a mobile number or (older scorer accounts) a
// username. Supabase Auth needs an email, so a mobile number or username is
// stored as <value>@<domain>. No emails are ever sent to those addresses.
export const SCORER_EMAIL_DOMAIN = "scorers.mtcc-uae.app";
export const PHONE_EMAIL_DOMAIN = "phone.mtcc-uae.app";

// Digits only, UAE style numbers (05xxxxxxxx, +9715xxxxxxxx, 009715...) become 9715xxxxxxxx.
export function normalisePhone(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "971" + d.slice(1);
  return d;
}

export function looksLikePhone(value: string): boolean {
  const v = value.trim();
  return !v.includes("@") && /^[+\d\s\-()]+$/.test(v) && normalisePhone(v).length >= 8;
}

export function toLoginEmail(value: string): string {
  const v = value.trim();
  if (v.includes("@")) return v;
  if (looksLikePhone(v)) return `${normalisePhone(v)}@${PHONE_EMAIL_DOMAIN}`;
  return `${v.toLowerCase()}@${SCORER_EMAIL_DOMAIN}`;
}
