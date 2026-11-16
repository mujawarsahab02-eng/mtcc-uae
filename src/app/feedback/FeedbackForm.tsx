"use client";

import { useState } from "react";
import { submitFeedback } from "./actions";

const INSTAGRAM_URL = "https://www.instagram.com/mtcc_uae/";
const YOUTUBE_URL = "https://www.youtube.com/@MTCCUAE";

const TYPES = ["Player", "Team owner or captain", "Sponsor or partner", "Volunteer or official", "Spectator or family member", "Other"];
const FORMATS = ["Just right", "Too short", "Too long", "No opinion"];
const SEASON2 = ["Yes, I'll play", "Yes, I'll bring a team", "Yes, I'll come as a spectator", "Interested as a sponsor", "Not sure yet"];
const RATED: { key: string; label: string }[] = [
  { key: "rating_organisation", label: "Organisation and match timings" },
  { key: "rating_ground", label: "Ground and facilities" },
  { key: "rating_food", label: "Food and hospitality" },
  { key: "rating_umpiring", label: "Umpiring and rules clarity" },
  { key: "rating_live_scores", label: "Live scores (website and CricHeroes)" },
];

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="text-3xl leading-none transition-transform active:scale-90 p-0.5"
          style={{ color: n <= value ? "#D4AF37" : "#D6D3CC" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Q({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <div className="flex gap-3 mb-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}>{n}</span>
        <h2 className="font-display font-bold text-sm text-navyText pt-1">{title}</h2>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  );
}

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? "" : o)}
          className="px-3.5 py-2 rounded-full text-sm border transition-colors"
          style={value === o ? { background: "#0B1B3A", color: "#fff", borderColor: "#0B1B3A" } : { background: "#fff", color: "#475569", borderColor: "rgba(0,0,0,0.12)" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-navyText outline-none focus:border-orange";

export default function FeedbackForm({ teams, closed, closesOn }: { teams: string[]; closed: boolean; closesOn: string | null }) {
  const [f, setF] = useState<Record<string, any>>({ overall: 0, auction_attended: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const isPlayerish = f.respondent_type === "Player" || f.respondent_type === "Team owner or captain";

  if (done) {
    return (
      <div className="bg-white rounded-3xl border border-black/5 shadow-sm p-8 text-center">
        <div className="text-5xl mb-3">🙏</div>
        <h2 className="font-display font-black text-2xl text-navyText mb-2">Thank you!</h2>
        <p className="text-sm text-slateText mb-6">Your feedback helps us make Season 2 even better. Dhanyawad!</p>
        <div className="rounded-2xl p-5 mb-2" style={{ background: "#FFF7E8" }}>
          <p className="font-semibold text-navyText text-sm mb-3">Please follow MTCC U.A.E. for Season 1 highlights and Season 2 updates</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-full text-white font-semibold text-sm" style={{ background: "linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)" }}>Follow on Instagram</a>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-full text-white font-semibold text-sm" style={{ background: "#FF0000" }}>Subscribe on YouTube</a>
          </div>
        </div>
        <p className="text-xs text-slateText mt-4">One Community. One Passion. One Championship.</p>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="bg-white rounded-3xl border border-black/5 shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">🏏</div>
        <h2 className="font-display font-bold text-xl text-navyText mb-2">Feedback is now closed</h2>
        <p className="text-sm text-slateText">Thank you to everyone who shared their thoughts{closesOn ? ` before ${closesOn}` : ""}. See you in Season 2!</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-full text-white font-semibold text-sm" style={{ background: "linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)" }}>Follow on Instagram</a>
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-full text-white font-semibold text-sm" style={{ background: "#FF0000" }}>Subscribe on YouTube</a>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.respondent_type) return setError("Please choose who you are (question 1).");
    if (!f.overall) return setError("Please give an overall rating (question 3).");
    setBusy(true);
    const res = await submitFeedback({ ...f, auction_rating: f.auction_attended ? f.auction_rating : null, team_name: isPlayerish ? f.team_name : null });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Hidden honeypot — real people never see or fill this */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website || ""} onChange={(e) => set("website", e.target.value)} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      <Q n={1} title="I was a…">
        <Choice options={TYPES} value={f.respondent_type || ""} onChange={(v) => set("respondent_type", v)} />
        {isPlayerish && teams.length > 0 && (
          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slateText mb-1.5">My team (optional)</label>
            <select className={inputCls} value={f.team_name || ""} onChange={(e) => set("team_name", e.target.value)}>
              <option value="">Select your team</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </Q>

      <Q n={2} title="Overall experience">
        <Stars value={f.overall} onChange={(n) => set("overall", n)} label="Overall experience" />
      </Q>

      <Q n={3} title="Rate each (optional)">
        <div className="space-y-3">
          {RATED.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-slateText">{r.label}</span>
              <Stars value={f[r.key] || 0} onChange={(n) => set(r.key, n)} label={r.label} />
            </div>
          ))}
        </div>
      </Q>

      <Q n={4} title="The 5-over format was…">
        <Choice options={FORMATS} value={f.format_opinion || ""} onChange={(v) => set("format_opinion", v)} />
      </Q>

      <Q n={5} title="Auction day (4 October)">
        <label className="flex items-center gap-2 text-sm text-slateText mb-3">
          <input type="checkbox" checked={!f.auction_attended} onChange={(e) => set("auction_attended", !e.target.checked)} />
          I didn't attend the auction
        </label>
        {f.auction_attended && <Stars value={f.auction_rating || 0} onChange={(n) => set("auction_rating", n)} label="Auction day" />}
      </Q>

      <Q n={6} title="What was the best part of the day? (optional)">
        <textarea className={inputCls} rows={3} maxLength={1500} value={f.best_part || ""} onChange={(e) => set("best_part", e.target.value)} />
      </Q>

      <Q n={7} title="What is the one thing we should improve? (optional)">
        <textarea className={inputCls} rows={3} maxLength={1500} value={f.improve || ""} onChange={(e) => set("improve", e.target.value)} />
      </Q>

      <Q n={8} title="Season 2">
        <Choice options={SEASON2} value={f.season2 || ""} onChange={(v) => set("season2", v)} />
      </Q>

      <Q n={9} title="Name and mobile number (optional)">
        <p className="text-xs text-slateText mb-3">Only fill this in if you're happy for us to follow up. Leave it empty to stay anonymous.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inputCls} placeholder="Name" maxLength={100} value={f.name || ""} onChange={(e) => set("name", e.target.value)} />
          <input className={inputCls} placeholder="Mobile number" inputMode="tel" maxLength={30} value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </Q>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-4 rounded-full text-white font-bold text-base shadow-lg disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}
      >
        {busy ? "Sending…" : "Submit Feedback"}
      </button>
      {closesOn && <p className="text-center text-xs text-slateText">Open until {closesOn}</p>}
    </form>
  );
}
