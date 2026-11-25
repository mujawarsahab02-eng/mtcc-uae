import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import type { GalleryItem } from "@/lib/gallery";
import GalleryClient from "./GalleryClient";

export const revalidate = 30;
export const metadata = { title: "Gallery | MTCC U.A.E. Season 1" };

export default async function GalleryPage() {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from("gallery_items")
    .select("*")
    .eq("hidden", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const { data: sponsors } = await supabase.from("sponsors").select("*").order("sort_order");
  const partners = (sponsors ?? [])
    .filter((s: any) => !s.is_powered_by && s.logo_path)
    .map((s: any) => ({
      name: s.name as string,
      logo: supabase.storage.from("sponsor-logos").getPublicUrl(s.logo_path).data.publicUrl as string,
    }));

  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />
      <GalleryClient items={(data ?? []) as GalleryItem[]} partners={partners} />
      <Footer />
    </div>
  );
}
