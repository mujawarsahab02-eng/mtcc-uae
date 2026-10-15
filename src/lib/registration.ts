// Player registration is closed once the closing date (end of day, UAE time) has passed
// or the registration cap has been reached.
export function registrationClosed(settings: { registration_close_date?: string | null; max_registrations?: number | null } | null, count: number): boolean {
  const max = settings?.max_registrations ?? 130;
  if (count >= max) return true;
  const close = settings?.registration_close_date;
  if (close) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
    if (today > close) return true;
  }
  return false;
}
