"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { AUCTION_ROLES, OVERRIDE_ROLES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

// Admin-only: replace a player's photo or a team's logo with an already-cropped image.
export async function saveImage(fd: FormData): Promise<any> {
  try {
    return await doSave(fd);
  } catch (e: any) {
    return { error: `Server error: ${e?.message || "unknown"}` };
  }
}

async function doSave(fd: FormData): Promise<any> {
  const profile = await getCurrentProfile();
  const allowed: string[] = [...AUCTION_ROLES, ...OVERRIDE_ROLES];
  if (!profile || !allowed.includes(profile.role)) return { error: "Only an admin can change photos and logos." };

  const kind = String(fd.get("kind") || "");
  const id = String(fd.get("id") || "");
  const file = fd.get("file") as any;
  if (!id || !file || (kind !== "player" && kind !== "team")) return { error: "Missing image." };

  const png = kind === "team";
  const bucket = kind === "player" ? "player-photos" : "team-logos";
  const path = `${id}/${Date.now()}.${png ? "png" : "jpg"}`;
  const supabase: any = createClient();

  const buf = Buffer.from(await file.arrayBuffer());
  const up = await supabase.storage.from(bucket).upload(path, buf, { contentType: png ? "image/png" : "image/jpeg", upsert: true });
  if (up?.error) return { error: `Upload failed: ${up.error.message}` };

  const table = kind === "player" ? "players" : "teams";
  const col = kind === "player" ? "photo_path" : "logo_path";
  const upd = await supabase.from(table).update({ [col]: path }).eq("id", id).select("id");
  if (upd?.error) return { error: `Saved the file but could not update the record: ${upd.error.message}` };
  if (!upd?.data || upd.data.length === 0) return { error: "The file was uploaded but the record was not updated (permission). Tell the developer." };

  revalidatePath("/squads");
  return { ok: true, path };
}
