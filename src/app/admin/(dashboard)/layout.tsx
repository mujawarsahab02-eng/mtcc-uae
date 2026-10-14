import { headers } from "next/headers";
import Link from "next/link";
import { requireProfile } from "@/lib/supabase/profile";
import { canAccess, homeFor } from "@/lib/adminAccess";
import Sidebar from "@/components/admin/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const path = headers().get("x-pathname") || "/admin";
  const allowed = canAccess(profile.role, path);

  return (
    <div className="min-h-screen flex">
      <Sidebar role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 md:py-8 pt-20 md:pt-8 pb-16">
        {allowed ? (
          children
        ) : (
          <div className="max-w-md mx-auto mt-16 text-center">
            <h1 className="text-xl font-bold mb-2">Access restricted</h1>
            <p className="text-sm text-mutedDim mb-5">Your account does not have permission to view this page.</p>
            <Link href={homeFor(profile.role)} className="text-blue font-semibold text-sm">Go back</Link>
          </div>
        )}
      </main>
    </div>
  );
}
