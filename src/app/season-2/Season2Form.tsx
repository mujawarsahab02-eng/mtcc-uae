"use client";

import { useState } from "react";
import { registerSeason2Interest } from "./actions";

const INTERESTS = ["Play as a player", "Bring a team", "Team owner", "Sponsor or partner", "Volunteer", "Spectator", "Other"];

export default function Season2Form() {
  const [v, setV] = useState({ name: "", phone: "", interest: "", organisation: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await registerSeason2Interest(v);
    setBusy(false);
    if (res.error) setErr(res.error); else setDone(true);
  }

  if (done) {
    return (
      <div className="text-center rounded-2xl bg-white border border-black/10 p-8">
        <div className="text-4xl mb-2">🏏</div>
        <div className="font-display font-black text-xl text-navyText mb-1">You are in!</div>
        <p className="text-sm text-slateText">Thank you. We will contact you on WhatsApp when Season 2 is announced.</p>
      </div>
    );
  }

  const cls = "w-full rounded-lg border border-black/15 bg-white px-3 py-3 text-sm text-navyText";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white border border-black/10 p-5 sm:p-6">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} className="hidden" aria-hidden />
      <div><label className="block text-xs font-semibold text-slateText mb-1">Your name</label><input className={cls} value={v.name} onChange={set("name")} required /></div>
      <div><label className="block text-xs font-semibold text-slateText mb-1">Phone / WhatsApp number</label><input className={cls} type="tel" inputMode="tel" value={v.phone} onChange={set("phone")} placeholder="+971 5X XXX XXXX" required /></div>
      <div>
        <label className="block text-xs font-semibold text-slateText mb-1">I would like to</label>
        <select className={cls} value={v.interest} onChange={set("interest")} required>
          <option value="">Choose…</option>
          {INTERESTS.map((i) => <option key={i}>{i}</option>)}
        </select>
      </div>
      <div><label className="block text-xs font-semibold text-slateText mb-1">Team or company (optional)</label><input className={cls} value={v.organisation} onChange={set("organisation")} /></div>
      <div><label className="block text-xs font-semibold text-slateText mb-1">Anything you would like to tell us (optional)</label><textarea className={cls} rows={3} value={v.message} onChange={set("message")} /></div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <button type="submit" disabled={busy} className="w-full rounded-lg py-3.5 font-bold text-[#151005] disabled:opacity-50" style={{ background: "linear-gradient(135deg,#D4AF37,#B8912C)" }}>
        {busy ? "Sending…" : "Count me in"}
      </button>
    </form>
  );
}
