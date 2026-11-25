"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { GALLERY_CATEGORIES, youtubeId } from "@/lib/gallery";
import { revalidatePath } from "next/cache";

async function guard(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) return "Only Super Admin or Tournament Admin can manage the gallery.";
  return null;
}

function refresh() {
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/");
}

const cleanCategory = (c: string) => ((GALLERY_CATEGORIES as readonly string[]).includes(c) ? c : "Other");

export async function addGalleryPhotos(
  rows: { id: string; path: string; thumb_path: string; width: number; height: number; category: string; title?: string | null; featured?: boolean }[]
): Promise<any> {
  const denied = await guard();
  if (denied) return { error: denied };
  if (!rows.length) return { ok: true };
  const supabase: any = createClient();
  const { error } = await supabase.from("gallery_items").insert(
    rows.map((r) => ({
      id: r.id,
      kind: "photo",
      category: cleanCategory(r.category),
      title: r.title?.trim() || null,
      path: r.path,
      thumb_path: r.thumb_path,
      width: r.width,
      height: r.height,
      featured: !!r.featured,
    }))
  );
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function addGalleryVideo(url: string, title: string): Promise<any> {
  const denied = await guard();
  if (denied) return { error: denied };
  const link = url.trim();
  if (!/^https?:\/\//i.test(link)) return { error: "Paste the full video link, starting with https://" };
  const vid = youtubeId(link);
  const isInsta = /instagram\.com\//i.test(link);
  if (!vid && !isInsta) return { error: "Only YouTube and Instagram links are supported." };
  const supabase: any = createClient();
  const { error } = await supabase.from("gallery_items").insert({
    kind: "video",
    category: "Videos",
    title: title.trim() || null,
    video_url: link,
    video_id: vid,
    featured: false,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function updateGalleryItem(id: string, patch: { category?: string; title?: string | null; featured?: boolean; hidden?: boolean }): Promise<any> {
  const denied = await guard();
  if (denied) return { error: denied };
  const clean: Record<string, any> = {};
  if (patch.category !== undefined) clean.category = cleanCategory(patch.category);
  if (patch.title !== undefined) clean.title = patch.title?.trim() || null;
  if (patch.featured !== undefined) clean.featured = patch.featured;
  if (patch.hidden !== undefined) clean.hidden = patch.hidden;
  const supabase: any = createClient();
  const { error } = await supabase.from("gallery_items").update(clean).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

// Bulk actions for long lists (for example the photographer's folder).
export async function bulkGallery(ids: string[], op: "hide" | "show" | "delete" | "category", value?: string): Promise<any> {
  const denied = await guard();
  if (denied) return { error: denied };
  if (!ids.length) return { ok: true };
  const supabase: any = createClient();
  if (op === "delete") {
    const { data: rows } = await supabase.from("gallery_items").select("id, path, thumb_path").in("id", ids);
    const files = (rows ?? []).flatMap((r: any) => [r.path, r.thumb_path]).filter(Boolean);
    if (files.length) await supabase.storage.from("gallery").remove(files);
    const { error } = await supabase.from("gallery_items").delete().in("id", ids);
    if (error) return { error: error.message };
  } else {
    const patch = op === "hide" ? { hidden: true } : op === "show" ? { hidden: false } : { category: cleanCategory(value || "Other") };
    const { error } = await supabase.from("gallery_items").update(patch).in("id", ids);
    if (error) return { error: error.message };
  }
  refresh();
  return { ok: true };
}
