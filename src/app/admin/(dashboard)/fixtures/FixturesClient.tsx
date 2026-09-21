"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LightButton, LightCard, LightField, LightSectionHeader, LightSeamDivider, LightStatusBadge } from "@/components/ui/light";
import { addMatch, updateMatch, deleteMatch } from "./actions";

const STAGES = ["League", "Quarter-Final", "Semi-Final", "Final"];
const STATUSES = ["Scheduled", "Live", "Completed", "Abandoned"];
const CUSTOM = "__custom__";

function emptyForm() {
  return {
    match_number: "", team_a_id: "", team_b_id: "", team_a_label: "", team_b_label: "",
    match_date: "", match_time: "", ground: "", group_name: "", stage: "League", stage_custom: "", status: "Scheduled",
    toss_winner_id: "", batting_first_id: "", team_a_score: "", team_a_overs: "",
    team_b_score: "", team_b_overs: "", winner_id: "", is_tie: false, margin: "", man_of_match: "", notes: "",
  };
}

export default function FixturesClient({ initialMatches, teams, canManage, isSuperAdmin }: { initialMatches: any[]; teams: any[]; canManage: boolean; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Keep the list in sync after router.refresh() brings new data from the server.
  useEffect(() => { setMatches(initialMatches); }, [initialMatches]);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "—";
  // A picked team's name, or the typed-in placeholder (e.g. "Winner of QF1").
  const sideName = (m: any, side: "a" | "b") => {
    const id = side === "a" ? m.team_a_id : m.team_b_id;
    const label = side === "a" ? m.team_a_label : m.team_b_label;
    return id ? teamName(id) : label || "TBA";
  };
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function resetForm() {
    setForm(emptyForm()); setErr(""); setAdding(false); setEditing(null);
  }
  function startEdit(m: any) {
    setEditing(m);
    const stageIsPreset = !m.stage || STAGES.includes(m.stage);
    setForm({
      match_number: m.match_number ?? "",
      team_a_id: m.team_a_id || (m.team_a_label ? CUSTOM : ""), team_a_label: m.team_a_label || "",
      team_b_id: m.team_b_id || (m.team_b_label ? CUSTOM : ""), team_b_label: m.team_b_label || "",
      match_date: m.match_date || "", match_time: m.match_time || "", ground: m.ground || "",
      group_name: m.group_name || "",
      stage: stageIsPreset ? (m.stage || "League") : CUSTOM, stage_custom: stageIsPreset ? "" : m.stage,
      status: m.status || "Scheduled",
      toss_winner_id: m.toss_winner_id || "", batting_first_id: m.batting_first_id || "",
      team_a_score: m.team_a_score || "", team_a_overs: m.team_a_overs ?? "", team_b_score: m.team_b_score || "",
      team_b_overs: m.team_b_overs ?? "", winner_id: m.winner_id || "", is_tie: !!m.is_tie,
      margin: m.margin || "", man_of_match: m.man_of_match || "", notes: m.notes || "",
    });
    setAdding(false);
  }

  function validate(): string | null {
    if (form.stage === CUSTOM && !form.stage_custom.trim()) return "Type the stage name, or pick one from the list.";
    if (form.team_a_id === CUSTOM && !form.team_a_label.trim()) return "Type a name for Team A, or pick a team from the list.";
    if (form.team_b_id === CUSTOM && !form.team_b_label.trim()) return "Type a name for Team B, or pick a team from the list.";
    if (form.team_a_id && form.team_a_id !== CUSTOM && form.team_a_id === form.team_b_id) return "Team A and Team B can't be the same team.";
    return null;
  }

  function buildPayload() {
    const aCustom = form.team_a_id === CUSTOM;
    const bCustom = form.team_b_id === CUSTOM;
    return {
      match_number: form.match_number ? Number(form.match_number) : null,
      team_a_id: aCustom ? null : form.team_a_id || null,
      team_b_id: bCustom ? null : form.team_b_id || null,
      team_a_label: aCustom ? form.team_a_label.trim() : null,
      team_b_label: bCustom ? form.team_b_label.trim() : null,
      match_date: form.match_date || null, match_time: form.match_time || null,
      ground: form.ground || null, group_name: form.group_name || null,
      stage: form.stage === CUSTOM ? form.stage_custom.trim() : form.stage,
      status: form.status,
      toss_winner_id: form.toss_winner_id || null, batting_first_id: form.batting_first_id || null,
      team_a_score: form.team_a_score || null, team_a_overs: form.team_a_overs ? Number(form.team_a_overs) : null,
      team_b_score: form.team_b_score || null, team_b_overs: form.team_b_overs ? Number(form.team_b_overs) : null,
      winner_id: form.winner_id || null, is_tie: !!form.is_tie,
      margin: form.margin || null, man_of_match: form.man_of_match || null, notes: form.notes || null,
    };
  }

  async function handleAdd() {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr("");
    const res: any = await addMatch(buildPayload());
    setBusy(false);
    if (res.error) setErr(res.error);
    else { resetForm(); router.refresh(); }
  }
  async function handleUpdate() {
    const v = validate();
    if (v) { setErr(v); return; }
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
    if (!window.confirm("Delete this match? Any scoring recorded for it will be deleted too. This can't be undone.")) return;
    setBusy(true);
    const res: any = await deleteMatch(id);
    setBusy(false);
    if (res.error) window.alert(res.error);
    else { setMatches((prev) => prev.filter((m) => m.id !== id)); router.refresh(); }
  }

  const teamSelect = (side: "a" | "b") => {
    const idKey = side === "a" ? "team_a_id" : "team_b_id";
    const labelKey = side === "a" ? "team_a_label" : "team_b_label";
    return (
      <LightField label={side === "a" ? "Team A" : "Team B"}>
        <select value={form[idKey]} onChange={set(idKey)}>
          <option value="">Select</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value={CUSTOM}>Type a name…</option>
        </select>
        {form[idKey] === CUSTOM && (
          <input className="mt-2" value={form[labelKey]} onChange={set(labelKey)} placeholder="e.g. Winner of QF1" />
        )}
      </LightField>
    );
  };

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader
        eyebrow="Admin"
        title="Fixtures & Results"
        action={canManage && !adding && !editing && <LightButton variant="primary" onClick={() => { resetForm(); setAdding(true); }}>Add Match</LightButton>}
      />
      <LightSeamDivider />

      {!canManage && (
        <LightCard className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Read-only for your role. Super Admin, Tournament Admin or Scorer can add and score fixtures.
        </LightCard>
      )}

      {(adding || editing) && (
        <LightCard className="p-5 mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-4 text-slateText">{editing ? "Edit Match" : "New Match"}</div>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Match Number"><input type="number" value={form.match_number} onChange={set("match_number")} /></LightField>
            <LightField label="Stage">
              <select value={form.stage} onChange={set("stage")}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={CUSTOM}>Custom…</option>
              </select>
              {form.stage === CUSTOM && (
                <input className="mt-2" value={form.stage_custom} onChange={set("stage_custom")} placeholder="e.g. Eliminator" />
              )}
            </LightField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {teamSelect("a")}
            {teamSelect("b")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <LightField label="Date"><input type="date" value={form.match_date} onChange={set("match_date")} /></LightField>
            <LightField label="Time"><input type="time" value={form.match_time} onChange={set("match_time")} /></LightField>
            <LightField label="Group"><input value={form.group_name} onChange={set("group_name")} placeholder="e.g. Group A" /></LightField>
          </div>
          <LightField label="Ground"><input value={form.ground} onChange={set("ground")} /></LightField>
          <LightField label="Status">
            <select value={form.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </LightField>

          {(form.status === "Completed" || form.status === "Live") && (
            <>
              <div className="w-full h-px my-4 bg-black/10" />
              <div className="text-[11px] font-bold uppercase tracking-wide mb-3 text-orange">Result Details</div>
              <div className="grid grid-cols-2 gap-3">
                <LightField label="Toss Winner">
                  <select value={form.toss_winner_id} onChange={set("toss_winner_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </LightField>
                <LightField label="Batting First">
                  <select value={form.batting_first_id} onChange={set("batting_first_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </LightField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LightField label="Team A Score"><input value={form.team_a_score} onChange={set("team_a_score")} placeholder="e.g. 145/6" /></LightField>
                <LightField label="Team A Overs"><input type="number" step="0.1" value={form.team_a_overs} onChange={set("team_a_overs")} /></LightField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LightField label="Team B Score"><input value={form.team_b_score} onChange={set("team_b_score")} placeholder="e.g. 140/8" /></LightField>
                <LightField label="Team B Overs"><input type="number" step="0.1" value={form.team_b_overs} onChange={set("team_b_overs")} /></LightField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LightField label="Winner">
                  <select value={form.winner_id} onChange={set("winner_id")}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </LightField>
                <LightField label="Margin"><input value={form.margin} onChange={set("margin")} placeholder="e.g. 5 runs / 3 wickets" /></LightField>
              </div>
              <label className="flex items-center gap-2 text-sm mb-4 text-slateText">
                <input type="checkbox" className="!w-auto" checked={form.is_tie} onChange={set("is_tie")} /> Match Tied / No Result
              </label>
              <LightField label="Man of the Match"><input value={form.man_of_match} onChange={set("man_of_match")} /></LightField>
              <LightField label="Notes"><textarea value={form.notes} onChange={set("notes")} rows={2} /></LightField>
            </>
          )}

          {err && <div className="text-xs mb-3 text-red">{err}</div>}
          <div className="flex gap-2">
            <LightButton variant="primary" onClick={editing ? handleUpdate : handleAdd} disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Add Match"}</LightButton>
            <LightButton variant="ghost" onClick={resetForm} disabled={busy}>Cancel</LightButton>
          </div>
        </LightCard>
      )}

      <div className="space-y-2">
        {matches.length === 0 && <LightCard className="p-8 text-center text-sm text-slateText">No matches scheduled yet.</LightCard>}
        {matches.map((m) => {
          const bothTeamsPicked = !!m.team_a_id && !!m.team_b_id;
          return (
            <LightCard key={m.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-slateText mb-1">{m.stage} {m.match_number ? `· Match ${m.match_number}` : ""}</div>
                  <div className="text-sm font-semibold text-navyText">{sideName(m, "a")} <span className="text-slateText">vs</span> {sideName(m, "b")}</div>
                  <div className="text-[11px] text-slateText mt-1">{m.match_date || "Date TBA"} {m.match_time || ""} {m.ground ? `· ${m.ground}` : ""}</div>
                  {m.status === "Completed" && (m.winner_id || m.is_tie) && (
                    <div className="text-xs text-orange mt-1">{m.is_tie ? "Match Tied" : `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}`}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <LightStatusBadge status={m.status} />
                  {canManage && m.status !== "Completed" && (
                    bothTeamsPicked ? (
                      <Link href={`/admin/scoring/${m.id}`} onClick={(e: any) => e.stopPropagation()}>
                        <LightButton variant="orange" size="sm">⚡ Score</LightButton>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-slateText">Pick both teams to score</span>
                    )
                  )}
                  {(m.status === "Completed" || m.status === "Live") && (
                    <Link href={`/matches/${m.id}`} onClick={(e: any) => e.stopPropagation()} className="text-[11px] text-blue underline">
                      {m.status === "Live" ? "Match Centre" : "Scorecard"}
                    </Link>
                  )}
                  {isSuperAdmin && (
                    <div className="flex gap-1.5">
                      <LightButton variant="ghost" size="sm" onClick={() => { startEdit(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</LightButton>
                      <LightButton variant="danger" size="sm" onClick={() => handleDelete(m.id)}>Delete</LightButton>
                    </div>
                  )}
                </div>
              </div>
            </LightCard>
          );
        })}
      </div>
    </div>
  );
}
