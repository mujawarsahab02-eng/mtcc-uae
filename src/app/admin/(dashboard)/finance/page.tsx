import { requireProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import FinanceClient from "./FinanceClient";

export const revalidate = 0;

export default async function FinancePage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: transactions } = await supabase.from("transactions").select("*").order("txn_date", { ascending: false });
  const { data: teams } = await supabase.from("teams").select("id, name, entry_fee_amount, entry_fee_status, entry_fee_paid_date").order("name");
  return <FinanceClient initialTransactions={transactions || []} teams={teams || []} currentRole={profile.role} />;
}
