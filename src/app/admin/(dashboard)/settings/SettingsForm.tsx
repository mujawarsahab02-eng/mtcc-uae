"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, FormSection, SectionHeader, SeamDivider } from "@/components/ui";
import { saveSettings } from "./actions";

export default function SettingsForm({ settings, canEdit, canToggleOverseas, currentRole }: any) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, any>>(settings ?? {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setDraft((d) => ({ ...d, [k]: val }));
  };
  const setNum = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }));

  async function handleSave() {
    setSaving(true);
    const saveResult: any = await saveSettings(draft);
    const { error } = saveResult;
    setSaving(false);
    if (!error) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Admin"
        title="Tournament Settings"
        action={canEdit && <Button variant="primary" onClick={handleSave} disabled={saving}>{saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}</Button>}
      />
      <SeamDivider />

      {!canEdit && (
        <Card className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Your role ({currentRole}) has read-only access to Tournament Settings. Only Super Admin and Tournament Admin can make changes. This is enforced by the database (RLS), not just hidden in the UI.
        </Card>
      )}

      <fieldset disabled={!canEdit} style={{ opacity: canEdit ? 1 : 0.6 }}>
        <FormSection title="General">
          <Field label="Tournament Name"><input value={draft.tournament_name || ""} onChange={set("tournament_name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Season Label"><input value={draft.season || ""} onChange={set("season")} /></Field>
            <Field label="Format Description"><input value={draft.format || ""} onChange={set("format")} /></Field>
          </div>
        </FormSection>

        <FormSection title="Schedule & Venue">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tournament Date"><input type="date" value={draft.tournament_date || ""} onChange={set("tournament_date")} /></Field>
            <Field label="Number of Grounds"><input type="number" value={draft.number_of_grounds ?? 1} onChange={setNum("number_of_grounds")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venue"><input value={draft.venue || ""} onChange={set("venue")} /></Field>
            <Field label="Ground Name"><input value={draft.ground_name || ""} onChange={set("ground_name")} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Reporting Time"><input type="time" value={draft.reporting_time || ""} onChange={set("reporting_time")} /></Field>
            <Field label="Start Time"><input type="time" value={draft.start_time || ""} onChange={set("start_time")} /></Field>
            <Field label="End Time"><input type="time" value={draft.end_time || ""} onChange={set("end_time")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration Opens"><input type="date" value={draft.registration_open_date || ""} onChange={set("registration_open_date")} /></Field>
            <Field label="Registration Closes"><input type="date" value={draft.registration_close_date || ""} onChange={set("registration_close_date")} /></Field>
          </div>
          <Field label="Auction Date/Time"><input type="datetime-local" value={draft.auction_date_time || ""} onChange={set("auction_date_time")} /></Field>
        </FormSection>

        <FormSection title="Teams & Squad">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Number of Teams" hint="Resizes team slots on save"><input type="number" value={draft.number_of_teams ?? 8} onChange={setNum("number_of_teams")} /></Field>
            <Field label="Maximum Squad Size" hint="Default: 14"><input type="number" value={draft.max_squad_size ?? 14} onChange={setNum("max_squad_size")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Playing XI"><input type="number" value={draft.playing_xi ?? 11} onChange={setNum("playing_xi")} /></Field>
            <Field label="Number of Overs" hint="Editable — not fixed to any default"><input type="number" value={draft.number_of_overs ?? 16} onChange={setNum("number_of_overs")} /></Field>
          </div>
        </FormSection>

        <FormSection title="Fees">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Currency"><input value={draft.currency || "AED"} onChange={set("currency")} /></Field>
            <Field label="Team Entry Fee" hint="Default: AED 1,500"><input type="number" value={draft.team_entry_fee ?? 1500} onChange={setNum("team_entry_fee")} /></Field>
            <Field label="Player Registration Fee" hint="Default: AED 25"><input type="number" value={draft.player_reg_fee ?? 25} onChange={setNum("player_reg_fee")} /></Field>
          </div>
        </FormSection>

        <FormSection title="Registration Limit & Perks">
          <Field label="Maximum Registrations" hint="Registration closes automatically once this many players have registered">
            <input type="number" value={draft.max_registrations ?? 130} onChange={setNum("max_registrations")} />
          </Field>
          <Field label="Player Perks Note" hint="Shown on the registration page (e.g. T-shirt, welcome kit)">
            <input value={draft.shirt_note || ""} onChange={set("shirt_note")} placeholder="A team T-shirt will be provided to every registered player." />
          </Field>
        </FormSection>

        <FormSection title="Bank Transfer Details">
          <p className="text-[11px] text-mutedDim mb-3">Shown to players on the registration page when they select &quot;Bank Transfer&quot; as their payment method.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Holder Name"><input value={draft.bank_account_name || ""} onChange={set("bank_account_name")} /></Field>
            <Field label="Bank Name"><input value={draft.bank_name || ""} onChange={set("bank_name")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Number"><input value={draft.bank_account_number || ""} onChange={set("bank_account_number")} /></Field>
            <Field label="IBAN"><input value={draft.bank_iban || ""} onChange={set("bank_iban")} /></Field>
          </div>
        </FormSection>

        <FormSection title="Eligibility">
          <Field label="Player Eligibility Mode">
            <select value={draft.eligibility_mode || "maharashtra_guest"} onChange={set("eligibility_mode")}>
              <option value="maharashtra_only">Maharashtra Players Only</option>
              <option value="maharashtra_guest">Maharashtra Players + Guest Indian Players</option>
            </select>
          </Field>
          {draft.eligibility_mode === "maharashtra_guest" && (
            <Field label="Guest Player Quota (per squad)" hint="Default: 3"><input type="number" value={draft.guest_quota ?? 3} onChange={setNum("guest_quota")} /></Field>
          )}
          <div className="flex gap-6 mb-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="!w-auto" checked={!!draft.cricheroes_required} onChange={set("cricheroes_required")} /> CricHeroes profile mandatory
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="!w-auto" checked={!!draft.emirates_id_required} onChange={set("emirates_id_required")} /> Valid Emirates ID mandatory
            </label>
          </div>
          <label className={`flex items-center gap-2 text-sm mb-4 text-muted ${canToggleOverseas ? "" : "opacity-50"}`}>
            <input type="checkbox" className="!w-auto" checked={!!draft.allow_overseas_category} onChange={set("allow_overseas_category")} disabled={!canToggleOverseas} />
            Allow &quot;Overseas / Special Category&quot; classification (Super Admin only)
          </label>
          <Field label="Player Eligibility Rules"><textarea value={draft.player_eligibility_rules || ""} onChange={set("player_eligibility_rules")} rows={3} /></Field>
        </FormSection>

        <FormSection title="Auction">
          <Field label="Auction Points per Team" hint="Virtual points only — no real currency is paid to players">
            <input type="number" value={draft.auction_points_per_team ?? 1000} onChange={setNum("auction_points_per_team")} />
          </Field>
        </FormSection>

        <FormSection title="Competition Rules">
          <Field label="Qualification Rules"><textarea value={draft.qualification_rules || ""} onChange={set("qualification_rules")} /></Field>
          <Field label="Points Rules"><textarea value={draft.points_rules || ""} onChange={set("points_rules")} /></Field>
          <Field label="Net Run Rate Rules"><textarea value={draft.nrr_rules || ""} onChange={set("nrr_rules")} /></Field>
          <Field label="Tie / Super Over Rules"><textarea value={draft.tie_break_rules || ""} onChange={set("tie_break_rules")} /></Field>
        </FormSection>

        <FormSection title="Terms & Conditions">
          <textarea value={draft.terms_and_conditions || ""} onChange={set("terms_and_conditions")} rows={5} />
        </FormSection>
      </fieldset>

      {canEdit && (
        <Button variant="primary" size="lg" className="w-full mt-2" onClick={handleSave} disabled={saving}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}
        </Button>
      )}
    </div>
  );
}
