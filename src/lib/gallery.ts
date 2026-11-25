export const GALLERY_CATEGORIES = [
  "Champions",
  "Runner-up",
  "Owners",
  "Teams",
  "Match Action",
  "Auction Night",
  "Committee",
  "Celebrations",
  "Crowd",
  "Other",
] as const;

export type GalleryItem = {
  id: string;
  kind: "photo" | "video";
  category: string;
  title: string | null;
  path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  video_url: string | null;
  video_id: string | null;
  featured: boolean;
  hidden: boolean;
  sort_order: number;
  created_at: string;
};

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gallery/`;

export function galleryUrl(path: string | null, downloadAs?: string) {
  if (!path) return "";
  return BASE + path + (downloadAs ? `?download=${encodeURIComponent(downloadAs)}` : "");
}

// YouTube watch / share / shorts / embed links -> 11 character video id.
export function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function videoThumb(item: Pick<GalleryItem, "video_id">) {
  return item.video_id ? `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg` : "";
}
