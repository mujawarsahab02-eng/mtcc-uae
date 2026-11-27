"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LightButton, LightCard, LightField, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";
import { GALLERY_CATEGORIES, galleryUrl, videoThumb, type GalleryItem } from "@/lib/gallery";
import { addGalleryPhotos, addGalleryVideo, bulkGallery, updateGalleryItem } from "./actions";

// Resize in the browser so the website stays fast: full photo max 1600px, grid preview max 640px.
async function toJpeg(file: File, maxSide: number, quality: number) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  if (typeof (bmp as any).close === "function") (bmp as any).close();
  const encode = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Could not compress ${file.name}`))), "image/jpeg", q)
    );
  let blob = await encode(quality);
  if (blob.size > 500 * 1024) blob = await encode(Math.max(0.6, quality - 0.12));
  return { blob, w, h };
}

const PAGE = 60;

// Work out a category from a folder name such as "Auction Night" or "Owners photos".
function categoryFromPath(path: string): string | null {
  const p = path.toLowerCase();
  const rules: [RegExp, string][] = [
    [/auction/, "Auction Night"], [/runner/, "Runner-up"], [/champion|winner|trophy/, "Champions"],
    [/owner/, "Owners"], [/committee|organi[sz]er/, "Committee"], [/celebrat/, "Celebrations"],
    [/crowd|fans|audience/, "Crowd"], [/team/, "Teams"], [/match|action|game|play/, "Match Action"],
  ];
  for (const [re, cat] of rules) if (re.test(p)) return cat;
  return null;
}

// Read the date a photo was taken (EXIF) before we resize it. Returns YYYY-MM-DD or null.
async function exifDate(file: File): Promise<string | null> {
  try {
    const buf = await file.slice(0, 131072).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const t = off + 10;
        const little = v.getUint16(t) === 0x4949;
        const u16 = (o: number) => v.getUint16(t + o, little);
        const u32 = (o: number) => v.getUint32(t + o, little);
        const readTag = (ifd: number, want: number): number | null => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === want) return u32(e + 8);
          }
          return null;
        };
        const exifPtr = readTag(u32(4), 0x8769);
        if (exifPtr === null) return null;
        const dtPtr = readTag(exifPtr, 0x9003) ?? readTag(exifPtr, 0x9004);
        if (dtPtr === null) return null;
        let str = "";
        for (let i = 0; i < 10; i++) str += String.fromCharCode(v.getUint8(t + dtPtr + i));
        const m = str.match(/^(\d{4}):(\d{2}):(\d{2})$/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if (marker < 0xff00) return null;
      off += 2 + len;
    }
  } catch { /* no usable EXIF */ }
  return null;
}

export default function GalleryAdmin({ initialItems, canManage }: { initialItems: GalleryItem[]; canManage: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [category, setCategory] = useState<string>("Match Action");
  const [featuredNew, setFeaturedNew] = useState(false);
  const [auto, setAuto] = useState(true);
  const folderRef = useRef<HTMLInputElement>(null);
  const lastClicked = useRef<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>("Match Action");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: items.length };
    for (const i of items) {
      const k = i.hidden ? "Hidden" : i.kind === "video" ? "Videos" : i.category;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [items]);

  const shown = items.filter((i) =>
    filter === "All" ? true : filter === "Hidden" ? i.hidden : filter === "Videos" ? i.kind === "video" && !i.hidden : i.category === filter && !i.hidden && i.kind === "photo"
  );

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length || !canManage) return;
    const files = Array.from(list).filter((f) => /^image\/(jpe?g|png|webp|heic|heif)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    const skipped = list.length - files.length;
    setMsg(skipped ? `${skipped} file(s) skipped because they are not photos.` : "");
    if (!files.length) return;
    setProgress({ done: 0, total: files.length, failed: 0 });
    let done = 0;
    let failed = 0;
    let next = 0;
    let pending: any[] = [];
    const created: GalleryItem[] = [];

    async function flush() {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      const res: any = await addGalleryPhotos(batch);
      if (res.error) {
        failed += batch.length;
        done -= batch.length;
        setMsg(res.error);
      } else {
        for (const r of batch) {
          created.push({ ...r, kind: "photo", title: null, video_url: null, video_id: null, hidden: false, sort_order: 0, created_at: new Date().toISOString(), featured: !!r.featured });
        }
      }
    }

    async function worker() {
      while (next < files.length) {
        const f = files[next++];
        try {
          const id = crypto.randomUUID();
          const full = await toJpeg(f, 1600, 0.82);
          const thumb = await toJpeg(f, 640, 0.75);
          const path = `photos/${id}.jpg`;
          const thumbPath = `thumbs/${id}.jpg`;
          const a = await supabase.storage.from("gallery").upload(path, full.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (a.error) throw new Error(a.error.message);
          const b = await supabase.storage.from("gallery").upload(thumbPath, thumb.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (b.error) throw new Error(b.error.message);
          let cat = category;
          if (auto) {
            const rel = (f as any).webkitRelativePath as string | undefined;
            const fromFolder = rel ? categoryFromPath(rel.split("/").slice(0, -1).join("/")) : null;
            if (fromFolder) cat = fromFolder;
            else if ((await exifDate(f)) === "2026-10-04") cat = "Auction Night";
          }
          pending.push({ id, path, thumb_path: thumbPath, width: full.w, height: full.h, category: cat, featured: featuredNew });
          done++;
          if (pending.length >= 10) await flush();
        } catch (e: any) {
          failed++;
          setMsg(`Could not upload ${f.name}: ${e.message}`);
        }
        setProgress({ done, total: files.length, failed });
      }
    }

    await Promise.all([worker(), worker(), worker()]);
    await flush();
    setProgress({ done, total: files.length, failed });
    if (created.length) setItems((prev) => [...created, ...prev]);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function handleVideo() {
    setBusy(true);
    setMsg("");
    const res: any = await addGalleryVideo(videoUrl, videoTitle);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setVideoUrl("");
    setVideoTitle("");
    router.refresh();
    // pick up the new row (id comes from the database)
    const { data } = await (supabase as any).from("gallery_items").select("*").order("created_at", { ascending: false });
    if (data) setItems(data);
  }

  async function patch(item: GalleryItem, p: Partial<GalleryItem>) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...p } : i)));
    const res: any = await updateGalleryItem(item.id, p as any);
    if (res.error) {
      setMsg(res.error);
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    }
  }

  async function bulk(op: "hide" | "show" | "delete" | "category") {
    const ids = Array.from(sel);
    if (!ids.length) return;
    if (op === "delete" && !window.confirm(`Delete ${ids.length} item(s) permanently? This cannot be undone.`)) return;
    setBusy(true);
    const res: any = await bulkGallery(ids, op, op === "category" ? bulkCat : undefined);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setItems((prev) =>
      op === "delete"
        ? prev.filter((i) => !sel.has(i.id))
        : prev.map((i) => (sel.has(i.id) ? { ...i, ...(op === "hide" ? { hidden: true } : op === "show" ? { hidden: false } : { category: bulkCat }) } : i))
    );
    setSel(new Set());
    router.refresh();
  }

  function clickSel(id: string, idx: number, shift: boolean) {
    const list = shown.slice(0, limit);
    if (shift && lastClicked.current !== null) {
      const [a, b] = [Math.min(lastClicked.current, idx), Math.max(lastClicked.current, idx)];
      setSel((prev) => { const n = new Set(prev); for (let i = a; i <= b; i++) n.add(list[i].id); return n; });
    } else toggleSel(id);
    lastClicked.current = idx;
  }

  function toggleSel(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const tabs = ["All", ...GALLERY_CATEGORIES.filter((c) => counts[c]), ...(counts["Videos"] ? ["Videos"] : []), ...(counts["Hidden"] ? ["Hidden"] : [])];
  const featuredCount = items.filter((i) => i.featured && !i.hidden && i.kind === "photo").length;

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title="Gallery" />
      <LightSeamDivider />

      {!canManage && (
        <LightCard className="p-3 mb-5 text-xs text-orange">Read-only for your role. Only Super Admin and Tournament Admin can manage the gallery.</LightCard>
      )}

      {canManage && (
        <>
          <LightCard className="p-5 mb-5">
            <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Add photos</div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <LightField label="Category for this upload">
                <select value={category} onChange={(e: any) => setCategory(e.target.value)}>
                  {GALLERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </LightField>
              <label className="flex items-center gap-2 text-sm text-navyText mt-6">
                <input type="checkbox" className="!w-auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                Sort automatically (by folder name, or 4 Oct photos as Auction Night). Otherwise the category on the left is used.
              </label>
              <label className="flex items-center gap-2 text-sm text-navyText mt-6">
                <input type="checkbox" className="!w-auto" checked={featuredNew} onChange={(e) => setFeaturedNew(e.target.checked)} />
                Show on the homepage "Glimpse of Season 1"
              </label>
            </div>
            <label
              className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
              style={{ borderColor: "#D4AF37", background: "rgba(212,175,55,0.06)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <div className="font-bold text-navyText">Tap to choose photos, or drop them here</div>
              <div className="text-xs text-slateText mt-1">
                You can pick hundreds at once. Each photo is resized on this device before upload (max 1600 px, about 300 to 500 KB), so you never need to compress anything.
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </label>
            <div className="mt-3 text-xs text-slateText">
              Have photos in folders named like "Auction", "Owners", "Champions" or "Match"? Choose the whole parent folder and each photo goes to the right category by itself.{" "}
              <button type="button" className="underline font-semibold text-navyText" onClick={() => folderRef.current?.click()}>Choose a folder</button>
              <input ref={folderRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)}
                {...({ webkitdirectory: "", directory: "" } as any)} />
            </div>
            {progress && (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full" style={{ width: `${Math.round(((progress.done + progress.failed) / progress.total) * 100)}%`, background: "#D4AF37" }} />
                </div>
                <div className="text-xs text-slateText mt-1">
                  Uploaded {progress.done} of {progress.total}{progress.failed ? `, ${progress.failed} failed` : ""}.
                  {progress.done + progress.failed < progress.total ? " Keep this page open." : " Done."}
                </div>
              </div>
            )}
          </LightCard>

          <LightCard className="p-5 mb-5">
            <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Add a video</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <LightField label="YouTube or Instagram link">
                  <input value={videoUrl} placeholder="https://youtu.be/..." onChange={(e: any) => setVideoUrl(e.target.value)} />
                </LightField>
              </div>
              <LightField label="Title (optional)">
                <input value={videoTitle} placeholder="Final highlights" onChange={(e: any) => setVideoTitle(e.target.value)} />
              </LightField>
            </div>
            <div className="text-xs text-slateText mb-3">Videos stay on YouTube or Instagram, so nothing heavy is stored on the website.</div>
            <LightButton variant="primary" onClick={handleVideo} disabled={busy || !videoUrl.trim()}>Add video</LightButton>
          </LightCard>
        </>
      )}

      {msg && <LightCard className="p-3 mb-4 text-xs text-orange">{msg}</LightCard>}

      <LightCard className="p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <button key={t} type="button" onClick={() => { setFilter(t); setLimit(PAGE); setSel(new Set()); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ borderColor: filter === t ? "#D4AF37" : "rgba(0,0,0,0.12)", background: filter === t ? "#D4AF37" : "transparent", color: filter === t ? "#0B1F3A" : "#566274" }}>
              {t} ({counts[t] ?? 0})
            </button>
          ))}
        </div>
        <div className="text-xs text-slateText mb-3">
          {featuredCount} photo(s) are shown on the homepage. The homepage shows the 5 newest featured photos.
        </div>

        {canManage && sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-black/5">
            <span className="text-xs font-bold text-navyText">{sel.size} selected</span>
            <LightButton variant="subtle" size="sm" onClick={() => bulk("hide")} disabled={busy}>Hide</LightButton>
            <LightButton variant="subtle" size="sm" onClick={() => bulk("show")} disabled={busy}>Show</LightButton>
            <select className="!w-auto text-xs" value={bulkCat} onChange={(e: any) => setBulkCat(e.target.value)}>
              {GALLERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <LightButton variant="subtle" size="sm" onClick={() => bulk("category")} disabled={busy}>Set category</LightButton>
            <LightButton variant="danger" size="sm" onClick={() => bulk("delete")} disabled={busy}>Delete</LightButton>
            <button type="button" className="text-xs underline text-slateText" onClick={() => setSel(new Set())}>Clear</button>
          </div>
        )}
        {canManage && shown.length > 0 && (
          <button type="button" className="text-xs underline text-slateText mb-3" onClick={() => setSel(new Set(shown.slice(0, limit).map((i) => i.id)))}>
            Select all shown
          </button>
        )}
        {canManage && shown.length > 0 && (
          <span className="text-xs text-slateText ml-3">Tip: tick one photo, then hold Shift and tick another to select everything between them.</span>
        )}

        {shown.length === 0 && <div className="text-sm text-slateText py-6 text-center">Nothing here yet.</div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {shown.slice(0, limit).map((i, idx) => (
            <div key={i.id} className="rounded-xl border border-black/10 overflow-hidden bg-white" style={{ opacity: i.hidden ? 0.5 : 1 }}>
              <div className="relative">
                <img src={i.kind === "video" ? videoThumb(i) : galleryUrl(i.thumb_path)} alt={i.title ?? ""} loading="lazy" className="w-full h-28 object-cover bg-black/5" />
                {i.kind === "video" && <span className="absolute left-2 top-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 text-white">VIDEO</span>}
                {canManage && (
                  <input type="checkbox" className="!w-auto absolute right-2 top-2 scale-125" checked={sel.has(i.id)} onChange={() => {}} onClick={(e: any) => clickSel(i.id, idx, e.shiftKey)} />
                )}
              </div>
              <div className="p-2 space-y-1.5">
                {canManage ? (
                  <>
                    <input defaultValue={i.title ?? ""} placeholder="Caption (optional)" className="text-xs"
                      onBlur={(e: any) => { if ((e.target.value || null) !== (i.title || null)) patch(i, { title: e.target.value || null }); }} />
                    {i.kind === "photo" && (
                      <select className="text-xs" value={i.category} onChange={(e: any) => patch(i, { category: e.target.value })}>
                        {GALLERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      {i.kind === "photo" ? (
                        <button type="button" onClick={() => patch(i, { featured: !i.featured })} style={{ color: i.featured ? "#B8921F" : "#566274", fontWeight: 700 }}>
                          {i.featured ? "★ Featured" : "☆ Feature"}
                        </button>
                      ) : <span />}
                      <button type="button" onClick={() => patch(i, { hidden: !i.hidden })} className="text-slateText underline">{i.hidden ? "Show" : "Hide"}</button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slateText">{i.title || i.category}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {shown.length > limit && (
          <div className="text-center mt-5">
            <LightButton variant="subtle" onClick={() => setLimit((l) => l + PAGE)}>Show more ({shown.length - limit} left)</LightButton>
          </div>
        )}
      </LightCard>
    </div>
  );
}
