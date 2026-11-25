"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GALLERY_CATEGORIES, galleryUrl, videoThumb, type GalleryItem } from "@/lib/gallery";

const WA = "https://wa.me/971555585757?text=" + encodeURIComponent("Hi MTCC U.A.E., I would like to partner with you for Season 2.");
const PAGE = 24;

export default function GalleryClient({ items, partners }: { items: GalleryItem[]; partners: { name: string; logo: string }[] }) {
  const [tab, setTab] = useState("All");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const photos = items.filter((i) => i.kind === "photo");
  const videos = items.filter((i) => i.kind === "video");
  const hero = photos.find((i) => i.featured) ?? photos[0];

  const tabs = useMemo(
    () => ["All", ...GALLERY_CATEGORIES.filter((c) => photos.some((p) => p.category === c)), ...(videos.length ? ["Videos"] : [])],
    [photos, videos.length]
  );
  const list = tab === "All" ? items : tab === "Videos" ? videos : photos.filter((p) => p.category === tab);
  const shown = list.slice(0, limit);
  const cur = open !== null ? list[open] : null;

  const step = useCallback(
    (d: number) => setOpen((o) => (o === null ? o : (o + d + Math.min(list.length, limit)) % Math.min(list.length, limit))),
    [list.length, limit]
  );

  useEffect(() => {
    if (open === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, step]);

  const stats = [
    ["8", "Teams"],
    ["13", "Matches"],
    ["5", "Overs a side"],
    ["Shams 11", "Champions"],
  ];

  return (
    <main>
      <section className="relative text-white text-center overflow-hidden" style={{ background: "#0B1F3A" }}>
        {hero && (
          <img src={galleryUrl(hero.path)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-xs uppercase tracking-[0.3em] font-bold mb-3" style={{ color: "#F0C94A" }}>Season 1 · Sharjah · 15 Nov 2026</div>
          <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase">Season 1 Gallery</h1>
          <p className="mt-3 text-white/75">The moments from the first Maharashtra Tennis Cricket Championship U.A.E. Tap any photo to view it and download it.</p>
        </div>
        <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          {stats.map(([v, l]) => (
            <div key={l} className="py-4 text-center border-white/10 sm:border-r last:border-r-0">
              <div className="font-display text-xl sm:text-2xl font-bold" style={{ color: "#F0C94A" }}>{v}</div>
              <div className="text-[11px] uppercase tracking-widest text-white/60">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {tabs.map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setLimit(PAGE); }}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={{ borderColor: tab === t ? "#D4AF37" : "rgba(0,0,0,0.12)", background: tab === t ? "#D4AF37" : "#fff", color: tab === t ? "#0B1F3A" : "#566274" }}>
              {t}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="text-center text-slateText py-16">Photos are on the way. Check back soon.</div>
        ) : (
          <div style={{ columnWidth: 240, columnGap: 12 }}>
            {shown.map((i, idx) => (
              <button key={i.id} type="button" onClick={() => setOpen(idx)} className="relative block w-full mb-3 rounded-xl overflow-hidden bg-black/5 group" style={{ breakInside: "avoid" }}>
                <img
                  src={i.kind === "video" ? videoThumb(i) : galleryUrl(i.thumb_path)}
                  alt={i.title ?? `MTCC Season 1 ${i.category}`}
                  loading="lazy"
                  width={i.width ?? undefined}
                  height={i.height ?? undefined}
                  className="w-full h-auto block transition-transform duration-300 group-hover:scale-105"
                />
                {i.kind === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center text-xl">▶</span>
                  </span>
                )}
                {i.title && (
                  <span className="absolute left-0 right-0 bottom-0 p-2 text-xs text-white text-left" style={{ background: "linear-gradient(transparent,rgba(0,0,0,0.7))" }}>{i.title}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {list.length > limit && (
          <div className="text-center mt-6">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="px-6 py-3 rounded-lg font-semibold bg-white border border-black/10 text-navyText">
              Load more ({list.length - limit} more)
            </button>
          </div>
        )}
      </section>

      {partners.length > 0 && (
        <section className="bg-white border-y border-black/5 py-12">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-6">Season 1 Partners</div>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {partners.map((p) => (
                <img key={p.name} src={p.logo} alt={p.name} loading="lazy" className="h-12 w-auto object-contain" />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 text-center text-white" style={{ background: "#0B1F3A" }}>
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase">Be part of Season 2</h2>
          <p className="mt-3 text-white/75">Put your brand in front of the Maharashtrian community across the U.A.E. Message us on WhatsApp and we will take it from there.</p>
          <a href={WA} target="_blank" rel="noopener noreferrer" className="inline-block mt-6 px-7 py-3.5 rounded-lg font-bold text-[#151005]" style={{ background: "linear-gradient(135deg,#D4AF37,#B8912C)" }}>
            Partner with us for Season 2
          </a>
        </div>
      </section>

      {cur && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-white/70">{open! + 1} / {Math.min(list.length, limit)}</span>
            <div className="flex items-center gap-3">
              {cur.kind === "photo" && (
                <a href={galleryUrl(cur.path, `MTCC-Season1-${cur.id.slice(0, 8)}.jpg`)} className="px-4 py-2 rounded-lg text-sm font-bold text-[#151005]" style={{ background: "#D4AF37" }}>
                  Download
                </a>
              )}
              <button type="button" onClick={() => setOpen(null)} className="text-2xl px-2" aria-label="Close">✕</button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/50 text-white text-xl" aria-label="Previous">‹</button>
            {cur.kind === "video" && cur.video_id ? (
              <iframe
                className="w-full max-w-4xl aspect-video rounded-lg"
                src={`https://www.youtube-nocookie.com/embed/${cur.video_id}?autoplay=1&rel=0`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : cur.kind === "video" ? (
              <a href={cur.video_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-white underline">Watch on {cur.video_url?.includes("instagram") ? "Instagram" : "the web"}</a>
            ) : (
              <img src={galleryUrl(cur.path)} alt={cur.title ?? ""} className="max-h-full max-w-full object-contain" />
            )}
            <button type="button" onClick={() => step(1)} className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/50 text-white text-xl" aria-label="Next">›</button>
          </div>
          <div className="p-3 text-center text-white/80 text-sm" onClick={(e) => e.stopPropagation()}>{cur.title ?? cur.category}</div>
        </div>
      )}
    </main>
  );
}
