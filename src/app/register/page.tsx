import { createClient } from "@/lib/supabase/server";
import RegisterForm from "@/components/register/RegisterForm";

export const revalidate = 0;

export default async function RegisterPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();

  return <RegisterForm settings={settings} />;
}
