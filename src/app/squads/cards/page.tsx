"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { saveImage } from "./actions";

// Printable squad cards: MTCC logo + name, team logo + name, owner, 14 players with photos.
// Open /squads/cards for all teams, or /squads/cards?team=<team id> for one.
const SLOTS = 14;
const rank = (p: any) => {
  const r = String(p.team_role || "Auction Player").toLowerCase();
  if (r.includes("owner")) return 0;
  if (r !== "auction player") return 1;
  return 2;
};
const labelOf = (p: any) => {
  const r = String(p.team_role || "Auction Player");
  return r === "Auction Player" ? "" : r.toUpperCase();
};

function buildSquad(t: any) {
  const list: any[] = [...(t.players || [])].sort((a, b) => rank(a) - rank(b));
  const owner = String(t.owner_name || "").trim().toLowerCase();
  const hasOwner = owner && list.some((p) => String(p.full_name || "").trim().toLowerCase() === owner);
  if (owner && !hasOwner && list.length < SLOTS) {
    list.unshift({ id: "owner", full_name: t.owner_name, team_role: "Owner", playing_role: "Owner", photo_path: null });
  }
  return list.slice(0, SLOTS);
}


// ---- Crop tool (admin) ----------------------------------------------------
const BOX = 300;
function Cropper({ kind, onCancel, onSave }: { kind: "player" | "team"; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const logo = kind === "team";

  function pick(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    const im = new Image();
    im.onload = () => { setImg(im); setZoom(1); setPos({ x: 0, y: 0 }); };
    im.src = URL.createObjectURL(f);
  }
  const base = img ? (logo ? Math.min(BOX / img.width, BOX / img.height) : Math.max(BOX / img.width, BOX / img.height)) : 1;
  const scale = base * zoom;
  const clamp = (x: number, y: number) => {
    if (!img || logo) return { x, y };
    const mx = Math.max(0, (img.width * scale - BOX) / 2), my = Math.max(0, (img.height * scale - BOX) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  function down(e: any) { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; e.currentTarget.setPointerCapture?.(e.pointerId); }
  function move(e: any) { if (drag.current) setPos(clamp(drag.current.px + e.clientX - drag.current.x, drag.current.py + e.clientY - drag.current.y)); }
  function up() { drag.current = null; }
  function changeZoom(z: number) { setZoom(z); setPos((p) => clamp(p.x, p.y)); }

  async function save() {
    if (!img) return;
    setSaving(true);
    const OUT = 500, k = OUT / BOX;
    const c = document.createElement("canvas"); c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d")!;
    if (!logo) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUT, OUT); }
    const w = img.width * scale * k, h = img.height * scale * k;
    ctx.drawImage(img, OUT / 2 + pos.x * k - w / 2, OUT / 2 + pos.y * k - h / 2, w, h);
    const blob: Blob | null = await new Promise((res) => c.toBlob((b) => res(b), logo ? "image/png" : "image/jpeg", 0.82));
    try { if (blob) await onSave(blob); } catch (e: any) { alert(`Could not save: ${e?.message || "unknown error"}`); }
    setSaving(false);
  }

  return (
    <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: 360, maxWidth: "94vw" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{logo ? "Upload team logo" : "Upload & crop player photo"}</div>
        <input type="file" accept="image/*" onChange={pick} />
        {img && (
          <>
            <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              style={{ width: BOX, height: BOX, margin: "12px auto", position: "relative", overflow: "hidden", background: logo ? "#e5e7eb" : "#000", touchAction: "none", cursor: "grab", borderRadius: logo ? 12 : "50%", border: "3px solid #D4AF37" }}>
              <img src={img.src} alt="" draggable={false}
                style={{ position: "absolute", left: BOX / 2 + pos.x - (img.width * scale) / 2, top: BOX / 2 + pos.y - (img.height * scale) / 2, width: img.width * scale, height: img.height * scale, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
            </div>
            <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>Drag to move. Use the slider to zoom.</div>
            <input type="range" min={logo ? 0.3 : 1} max={4} step={0.02} value={zoom} onChange={(e: any) => changeZoom(Number(e.target.value))} style={{ width: "100%", marginTop: 6 }} />
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onCancel} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={!img || saving} style={{ padding: "8px 16px", borderRadius: 8, border: 0, background: "#0B1F3A", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: !img || saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SquadCardsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState<any[] | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState<{ kind: "player" | "team"; id: string; teamId: string } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setOnly(new URLSearchParams(window.location.search).get("team"));
    (async () => { try { const { data } = await (supabase as any).auth.getSession(); setAdmin(!!data?.session); } catch { /* ignore */ } })();
    (async () => {
      const { data } = await supabase.rpc("public_squads");
      setTeams(Array.isArray(data) ? data : []);
    })();
  }, [supabase]);

  const url = (bucket: string, path: string | null) => {
    try { return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null; } catch { return null; }
  };

  async function loadH2C(): Promise<any> {
    if ((window as any).html2canvas) return (window as any).html2canvas;
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      s.onload = () => res(); s.onerror = () => rej(new Error("load"));
      document.head.appendChild(s);
    });
    return (window as any).html2canvas;
  }

  async function downloadPng(t: any) {
    const el = refs.current[t.id];
    if (!el) return;
    setBusy(t.id);
    try {
      const h2c = await loadH2C();
      const canvas = await h2c(el, { scale: 2, useCORS: true, backgroundColor: "#0A0F1C" });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `MTCC-${String(t.name).replace(/[^a-z0-9]+/gi, "-")}-Squad.png`;
      a.click();
    } catch { alert("Could not create the image. Use Print / Save as PDF instead."); }
    setBusy("");
  }

  async function saveEdit(blob: Blob) {
    if (!editing) return;
    const fd = new FormData();
    fd.append("kind", editing.kind); fd.append("id", editing.id);
    fd.append("file", blob, editing.kind === "team" ? "logo.png" : "photo.jpg");
    let res: any;
    try { res = await saveImage(fd); } catch (e: any) { res = { error: `Could not save: ${e?.message || "the server did not respond. Try a smaller photo."}` }; }
    if (res?.error) { setNote(res.error); alert(res.error); return; }
    // Re-read the squads from the database so the card always shows what is really saved.
    try {
      const { data } = await supabase.rpc("public_squads");
      if (Array.isArray(data)) setTeams(data);
    } catch { /* ignore */ }
    setNote(res ? "Saved. The change is live on the website too." : "Sent. The cards were refreshed from the database. Please check the photo.");
    setEditing(null);
  }

  const shown = (teams ?? []).filter((t) => !only || t.id === only);

  return (
    <div style={{ background: "#e9ecf2", minHeight: "100vh" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .sheet-wrap { margin: 0 !important; padding: 0 !important; box-shadow: none !important; page-break-after: always; }
        }
      `}</style>
      <div className="no-print" style={{ padding: 16, textAlign: "center", fontFamily: "sans-serif" }}>
        <button onClick={() => window.print()} style={{ padding: "10px 22px", borderRadius: 10, background: "#0B1F3A", color: "#fff", fontWeight: 700, border: 0, cursor: "pointer" }}>
          Print / Save as PDF {only ? "" : "(all teams)"}
        </button>
        {only && <a href="/squads/cards" style={{ marginLeft: 12, color: "#0B1F3A", fontWeight: 600 }}>Show all teams</a>}
        <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>In the print window choose “Save as PDF”, paper A4, margins None, and tick “Background graphics”.</div>
        {admin && <div style={{ marginTop: 8, fontSize: 12, color: "#0B1F3A", fontWeight: 600 }}>Admin edit is on: use “Change logo” above a card, or the ✎ on a player to upload and crop a photo.</div>}
        {note && <div style={{ marginTop: 6, fontSize: 12, color: "#0a6b2d", fontWeight: 600 }}>{note}</div>}
        {teams === null && <div style={{ marginTop: 12 }}>Loading…</div>}
        {teams !== null && shown.length === 0 && <div style={{ marginTop: 12 }}>No teams found.</div>}
      </div>

      {shown.map((t) => {
        const squad = buildSquad(t);
        const tl = url("team-logos", t.logo_path);
        const slots = Array.from({ length: SLOTS }, (_, i) => squad[i] || null);
        return (
          <div key={t.id} className="sheet-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <button className="no-print" onClick={() => downloadPng(t)} disabled={busy === t.id}
              style={{ marginBottom: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid #0B1F3A", background: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif", fontSize: 12 }}>
              {busy === t.id ? "Creating image…" : `Download ${t.name} as image (PNG)`}
            </button>
            {admin && (
              <button className="no-print" onClick={() => setEditing({ kind: "team", id: t.id, teamId: t.id })}
                style={{ marginBottom: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid #D4AF37", background: "#fff8e1", fontWeight: 600, cursor: "pointer", fontFamily: "sans-serif", fontSize: 12 }}>
                Change logo
              </button>
            )}
            <div ref={(el: HTMLDivElement | null) => { refs.current[t.id] = el; }}
              style={{ width: 794, height: 1123, background: "radial-gradient(ellipse at 50% 0%, #1B2A4D 0%, #0B1224 55%, #05070d 100%)", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", position: "relative", overflow: "hidden", boxSizing: "border-box", border: "6px solid #D4AF37" }}>
              {/* Header */}
              <div style={{ textAlign: "center", paddingTop: 26 }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", margin: "0 auto", border: "3px solid #D4AF37", background: "#fff" }}>
                  <Logo className="w-full h-full" />
                </div>
                <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900, letterSpacing: 1, color: "#F0C94A" }}>MTCC U.A.E.</div>
                <div style={{ fontSize: 12, letterSpacing: 3, opacity: 0.8 }}>MAHARASHTRA TENNIS CRICKET CHAMPIONSHIP · SEASON 1</div>
              </div>
              <div style={{ height: 2, margin: "14px 60px", background: "linear-gradient(90deg, transparent, #D4AF37, transparent)" }} />
              {/* Team */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
                <div style={{ width: 96, height: 96, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {tl ? <img src={tl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} /> : <span style={{ color: "#0B1F3A", fontWeight: 900, fontSize: 28 }}>{String(t.name).slice(0, 2).toUpperCase()}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.05 }}>{t.name}</div>
                  {t.owner_name && <div style={{ marginTop: 8, fontSize: 16, color: "#F0C94A" }}>Owner: <b style={{ color: "#fff" }}>{t.owner_name}</b></div>}
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, letterSpacing: 4, color: "#D4AF37", fontWeight: 700 }}>SQUAD · 14 PLAYERS</div>
              {/* Players */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 34px" }}>
                {slots.map((p, i) => {
                  const ph = p ? url("player-photos", p.photo_path) : null;
                  const lab = p ? labelOf(p) : "";
                  return (
                    <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.06)", border: lab ? "1px solid #D4AF37" : "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 8, height: 94, boxSizing: "border-box" }}>
                      <div style={{ width: 24, textAlign: "center", fontWeight: 900, color: "#D4AF37", fontSize: 15 }}>{i + 1}</div>
                      <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "#1B2A4D", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {ph ? <img src={ph} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontWeight: 900, fontSize: 22, color: "#D4AF37" }}>{p ? String(p.full_name || "?").slice(0, 1) : ""}</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15 }}>{p ? p.full_name : "—"}</div>
                        {p && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{lab ? "" : p.playing_role}</div>}
                        {lab && <div style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 900, background: "#D4AF37", color: "#0A0F1C", padding: "2px 8px", borderRadius: 20, letterSpacing: 1 }}>{lab}</div>}
                      </div>
                      {admin && p && p.id !== "owner" && (
                        <button className="no-print" data-html2canvas-ignore="true" onClick={() => setEditing({ kind: "player", id: p.id, teamId: t.id })}
                          title="Upload / crop photo" style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", border: 0, background: "#D4AF37", color: "#0A0F1C", fontWeight: 900, cursor: "pointer", fontSize: 13 }}>✎</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ position: "absolute", bottom: 14, width: "100%", textAlign: "center", fontSize: 11, letterSpacing: 3, color: "#D4AF37" }}>MTCC U.A.E. · SEASON 1 · mtccuae.com</div>
            </div>
          </div>
        );
      })}
      {editing && <Cropper kind={editing.kind} onCancel={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}
