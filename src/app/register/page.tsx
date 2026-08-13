import { createClient } from "@/lib/supabase/server";
import RegisterForm from "@/components/register/RegisterForm";

export const revalidate = 0;

export default async function RegisterPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();
  const { count } = await supabase.from("players").select("*", { count: "exact", head: true });

  const maxReg = settings?.max_registrations ?? 130;
  const currentCount = count ?? 0;
  const closed = currentCount >= maxReg;
  const spotsRemaining = Math.max(0, maxReg - currentCount);

  return <RegisterForm settings={settings} closed={closed} spotsRemaining={spotsRemaining} />;
}
