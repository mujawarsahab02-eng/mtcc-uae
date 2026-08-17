"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, SectionHeader, SeamDivider, StatusBadge } from "@/components/ui";
import { addMatch, updateMatch, deleteMatch } from "./actions";

const STAGES = ["League", "Quarter-Final", "Semi-Final", "Final"];
const STATUSES = ["Scheduled", "Live", "Completed", "Abandoned"];

function emptyForm() {
  return {
    match_number: "", team_a_id: "", team_b_id: "", match_date: "", match_time: "",
    ground: "", group_name: "", stage: "League", status: "Scheduled",
    toss_winner_id: "", batting_first_id: "", team_a_score: "", team_a_overs: "",
    team_b_score: "", team_b_overs: "", winner_id: "", is_tie: false, margin: "", man_of_match: "", notes: "",
  };
}

export default function FixturesClient({ initialMatches, teams, canManage }: { initialMatches: any[]; teams: any[]; canManage: boolean }) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "—";
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function resetForm() {
    setForm(emptyForm()); setErr(""); setAdding(false); setEditing(null);
  }
  function startEdit(m: any) {
    setEditing(m);
    setForm({
      match_number: m.match_number ?? "", team_a_id: m.team_a_id || "", team_b_id: m.team_b_id || "",
      match_date: m.match_date || "", match_time: m.match_time || "", ground: m.ground || "",
      group_name: m.group_name || "", stage: m.stage || "League", status: m.status || "Scheduled",
      toss_winner_id: m.toss_winner_id || "", batting_first_id: m.batting_first_id || "",
      team_a_score: m.team_a_score || "", team_a_overs: m.team_a_overs ?? "", team_b_score: m.team_b_score || "",
      team_b_overs: m.team_b_overs ?? "", winner_id: m.winner_id || "", is_tie: !!m.is_tie,
      margin: m.margin || "", man_of_match: m.man_of_match || "", notes: m.notes || "",
    });
    setAdding(false);
  }

  function buildPayload() {
    return {
      match_number: form.match_number ? Number(form.match_number) : null,
      team_a_id: form.team_a_id || null, team_b_id: form.team_b_id || null,
      match_date: form.match_date || null, match_time: form.match_time || null,
      ground: form.ground || null, group_name: form.group_name || null,
      stage: form.stage, status: form.status,
      toss_winner_id: form.toss_winner_id || null, batting_first_id: form.batting_first_id || null,
      team_a_score: form.team_a_score || null, team_a_overs: form.team_a_overs ? Number(form.team_a_overs) : null,
      team_b_score: form.team_b_score || null, team_b_overs: form.team_b_overs ? Number(form.team_b_overs) : null,
      winner_id: form.winner_id || null, is_tie: !!form.is_tie,
      margin: form.margin || null, man_of_match: form.man_of_match || null, notes: form.notes || null,
    };
  }

  async function handleAdd() {
    setBusy(true); setErr("");
    const res: any = await addMatch(buildPayload());
    setBusy(false);
    if (res.error) setErr(res.error);
    else { resetForm(); router.refresh(); }
  }
  async function handleUpdate() {
    setBusy(true); setErr("");
    const res: any = await updateMatch(editing.id, buildPayload());
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      setMatches((prev) => prev.map((m) => (m.id === editing.id ? { ...m, ...buildPayload() } : m)));
      resetForm(); router.refresh();
    }
  }
  async function handleDelete(id: string) {
    setBusy(true);
    const res: any = await deleteMatch(id);
    setBusy(false);
    if (!res.error) { setMatches((prev) => prev.filter((m) => m.id !== id)); router.refresh(); }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Admin"
        title="Fixtures & Results"
        action={canManage && !adding && !editing && <Button variant="primary" onClick={() => { resetForm(); setAdding(true); }}>Add Match</Button>}
      />
      <SeamDivider />

      {!canManage && (
        <Card className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Read-only for your role. Super Admin, Tournament Admin or Scorer can manage fixtures.
        </Card>
      )}

      {(adding || editing) && (
        <Card className="p-5 mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-4 text-muted">{editing ? "Edit Match" : "New Match"}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Match Number"><input type="number" value={form.match_number} onChange={set("match_number")} /></Field>
            <Field label="Stage">
              <select value={form.stage} onChange={set("stage")}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team A">
              <select value={form.team_a_id} onChange={set("team_a_id")}><option value="">Select</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </Field>
            <Field label="Team B">
              <select value={form.team_b_id} onChange={set("team_b_id")}><option value="">Select</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date"><input type="date" value={form.match_date} onChange={set("match_date")} /></Field>
            <Field label="Time"><input type="time" value={form.match_time} onChange={set("match_time")} /></Field>
            <Field label="Group"><input value={form.group_name} onChange={set("group_name")} placeholder="e.g. Group A" /></Field>
          </div>
          <Field label="Ground"><input value={form.ground} onChange={set("ground")} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>

          {(form.status === "Completed" || form.status === "Live") && (
            <>
              <div className="w-full h-px my-4" style={{ background: "rgba(212,175,55,0.2)" }} />
              <div className="text-[11px] font-bold uppercase tracking-wide mb-3 text-goldBright">Result Details</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Toss Winner">
                  <select value={form.toss_winner_id} onChange={set("toss_winner_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </Field>
                <Field label="Batting First">
                  <select value={form.batting_first_id} onChange={set("batting_first_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Team A Score"><input value={form.team_a_score} onChange={set("team_a_score")} placeholder="e.g. 145/6" /></Field>
                <Field label="Team A Overs"><input type="number" step="0.1" value={form.team_a_overs} onChange={set("team_a_overs")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Team B Score"><input value={form.team_b_score} onChange={set("team_b_score")} placeholder="e.g. 140/8" /></Field>
                <Field label="Team B Overs"><input type="number" step="0.1" value={form.team_b_overs} onChange={set("team_b_overs")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Winner">
                  <select value={form.winner_id} onChange={set("winner_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </Field>
                <Field label="Margin"><input value={form.margin} onChange={set("margin")} placeholder="e.g. 5 runs / 3 wickets" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm mb-4 text-muted">
                <input type="checkbox" className="!w-auto" checked={form.is_tie} onChange={set("is_tie")} /> Match Tied / No Result
              </label>
              <Field label="Man of the Match"><input value={form.man_of_match} onChange={set("man_of_match")} /></Field>
              <Field label="Notes"><textarea value={form.notes} onChange={set("notes")} rows={2} /></Field>
            </>
          )}

          {err && <div className="text-xs mb-3 text-red">{err}</div>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={editing ? handleUpdate : handleAdd} disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Add Match"}</Button>
            <Button variant="ghost" onClick={resetForm} disabled={busy}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {matches.length === 0 && <Card className="p-8 text-center text-sm text-mutedDim">No matches scheduled yet.</Card>}
        {matches.map((m) => (
          <Card key={m.id} className="p-4 cursor-pointer" onClick={() => canManage && startEdit(m)}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs text-mutedDim mb-1">{m.stage} {m.match_number ? `· Match ${m.match_number}` : ""}</div>
                <div className="text-sm font-semibold">{teamName(m.team_a_id)} <span className="text-mutedDim">vs</span> {teamName(m.team_b_id)}</div>
                <div className="text-[11px] text-mutedDim mt-1">{m.match_date || "Date TBA"} {m.match_time || ""} {m.ground ? `· ${m.ground}` : ""}</div>
                {m.status === "Completed" && (m.winner_id || m.is_tie) && (
                  <div className="text-xs text-goldBright mt-1">{m.is_tie ? "Match Tied" : `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}`}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={m.status} />
                {canManage && <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>Remove</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
