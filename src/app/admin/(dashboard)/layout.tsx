import { requireProfile } from "@/lib/supabase/profile";
import Sidebar from "@/components/admin/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen flex">
      <Sidebar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 md:py-8 pt-20 md:pt-8 pb-16">{children}</main>
    </div>
  );
}
