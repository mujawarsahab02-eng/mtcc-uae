import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Used in Client Components. Respects RLS as the signed-in user (or anon).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
