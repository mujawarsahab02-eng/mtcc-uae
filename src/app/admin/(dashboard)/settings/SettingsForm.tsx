"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LightButton, LightCard, LightField, LightFormSection, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";
import { createClient } from "@/lib/supabase/client";
import { saveSettings } from "./actions";
import { applyPurseToAllTeams } from "../teams/actions";

export default function SettingsForm({ settings, canEdit, canToggleOverseas, currentRole }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<Record<string, any>>(settings ?? {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingPurse, setApplyingPurse] = useState(false);
  const [purseMsg, setPurseMsg] = useState("");
  const [poweredByLogoFile, setPoweredByLogoFile] = useState<File | null>(null);
  const [ziinaQrFile, setZiinaQrFile] = useState<File | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setDraft((d) => ({ ...d, [k]: val }));
  };
  const setNum = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }));

  async function handleSave() {
    setSaving(true);
    let finalDraft = draft;
    if (poweredByLogoFile) {
      const path = `powered-by-${crypto.randomUUID()}-${poweredByLogoFile.name.replace(/\s+/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("sponsor-logos").upload(path, poweredByLogoFile);
      if (!uploadError) finalDraft = { ...finalDraft, powered_by_logo_path: path };
    }
    if (ziinaQrFile) {
      const path = `ziina-qr-${crypto.randomUUID()}-${ziinaQrFile.name.replace(/\s+/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("payment-assets").upload(path, ziinaQrFile);
      if (!uploadError) finalDraft = { ...finalDraft, ziina_qr_path: path };
    }
    const saveResult: any = await saveSettings(finalDraft);
    const { error } = saveResult;
    setSaving(false);
    if (!error) {
      setSaved(true);
      setPoweredByLogoFile(null);
      setZiinaQrFile(null);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleApplyPurseToAll() {
    setApplyingPurse(true);
    setPurseMsg("");
    const res: any = await applyPurseToAllTeams(Number(draft.auction_points_per_team ?? 1000));
    setApplyingPurse(false);
    if (res.error) setPurseMsg(res.error);
    else { setPurseMsg("Applied to all teams ✓"); router.refresh(); setTimeout(() => setPurseMsg(""), 3000); }
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader
        eyebrow="Admin"
        title="Tournament Settings"
        action={canEdit && <LightButton variant="primary" onClick={handleSave} disabled={saving}>{saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}</LightButton>}
      />
      <LightSeamDivider />

      {!canEdit && (
        <LightCard className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Your role ({currentRole}) has read-only access to Tournament Settings. Only Super Admin and Tournament Admin can make changes. This is enforced by the database (RLS), not just hidden in the UI.
        </LightCard>
      )}

      <fieldset disabled={!canEdit} style={{ opacity: canEdit ? 1 : 0.6 }}>
        <LightFormSection title="General">
          <LightField label="Tournament Name"><input value={draft.tournament_name || ""} onChange={set("tournament_name")} /></LightField>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Season Label"><input value={draft.season || ""} onChange={set("season")} /></LightField>
            <LightField label="Format Description"><input value={draft.format || ""} onChange={set("format")} /></LightField>
          </div>
        </LightFormSection>

        <LightFormSection title="Schedule & Venue">
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Tournament Date"><input type="date" value={draft.tournament_date || ""} onChange={set("tournament_date")} /></LightField>
            <LightField label="Number of Grounds"><input type="number" value={draft.number_of_grounds ?? 1} onChange={setNum("number_of_grounds")} /></LightField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Venue"><input value={draft.venue || ""} onChange={set("venue")} /></LightField>
            <LightField label="Ground Name"><input value={draft.ground_name || ""} onChange={set("ground_name")} /></LightField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <LightField label="Reporting Time"><input type="time" value={draft.reporting_time || ""} onChange={set("reporting_time")} /></LightField>
            <LightField label="Start Time"><input type="time" value={draft.start_time || ""} onChange={set("start_time")} /></LightField>
            <LightField label="End Time"><input type="time" value={draft.end_time || ""} onChange={set("end_time")} /></LightField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Registration Opens"><input type="date" value={draft.registration_open_date || ""} onChange={set("registration_open_date")} /></LightField>
            <LightField label="Registration Closes"><input type="date" value={draft.registration_close_date || ""} onChange={set("registration_close_date")} /></LightField>
          </div>
          <LightField label="Auction Date/Time"><input type="datetime-local" value={draft.auction_date_time || ""} onChange={set("auction_date_time")} /></LightField>
        </LightFormSection>

        <LightFormSection title="Teams & Squad">
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Number of Teams" hint="Resizes team slots on save"><input type="number" value={draft.number_of_teams ?? 8} onChange={setNum("number_of_teams")} /></LightField>
            <LightField label="Maximum Squad Size" hint="Default: 14"><input type="number" value={draft.max_squad_size ?? 14} onChange={setNum("max_squad_size")} /></LightField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Playing XI"><input type="number" value={draft.playing_xi ?? 11} onChange={setNum("playing_xi")} /></LightField>
            <LightField label="Number of Overs" hint="Editable — not fixed to any default"><input type="number" value={draft.number_of_overs ?? 16} onChange={setNum("number_of_overs")} /></LightField>
          </div>
        </LightFormSection>

        <LightFormSection title="Fees">
          <div className="grid grid-cols-3 gap-3">
            <LightField label="Currency"><input value={draft.currency || "AED"} onChange={set("currency")} /></LightField>
            <LightField label="Team Entry Fee" hint="Default: AED 1,500"><input type="number" value={draft.team_entry_fee ?? 1500} onChange={setNum("team_entry_fee")} /></LightField>
            <LightField label="Player Registration Fee" hint="Default: AED 25"><input type="number" value={draft.player_reg_fee ?? 25} onChange={setNum("player_reg_fee")} /></LightField>
          </div>
        </LightFormSection>

        <LightFormSection title="Registration Limit & Perks">
          <LightField label="Maximum Registrations" hint="Registration closes automatically once this many players have registered">
            <input type="number" value={draft.max_registrations ?? 130} onChange={setNum("max_registrations")} />
          </LightField>
          <LightField label="Player Perks Note" hint="Shown on the registration page (e.g. T-shirt, welcome kit)">
            <input value={draft.shirt_note || ""} onChange={set("shirt_note")} placeholder="A team T-shirt will be provided to every registered player." />
          </LightField>
        </LightFormSection>

        <LightFormSection title="WhatsApp Group">
          <p className="text-[11px] text-slateText mb-3">Shown to players on the registration confirmation page as a one-tap &quot;Join our WhatsApp Group&quot; button.</p>
          <LightField label="WhatsApp Group Invite Link" hint="Get this from WhatsApp: open the group → tap the group name → Invite via Link">
            <input value={draft.whatsapp_group_link || ""} onChange={set("whatsapp_group_link")} placeholder="https://chat.whatsapp.com/..." />
          </LightField>
        </LightFormSection>

        <LightFormSection title="Bank Transfer Details">
          <p className="text-[11px] text-slateText mb-3">Shown to players on the registration page when they select &quot;Bank Transfer&quot; as their payment method.</p>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Account Holder Name"><input value={draft.bank_account_name || ""} onChange={set("bank_account_name")} /></LightField>
            <LightField label="Bank Name"><input value={draft.bank_name || ""} onChange={set("bank_name")} /></LightField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LightField label="Account Number"><input value={draft.bank_account_number || ""} onChange={set("bank_account_number")} /></LightField>
            <LightField label="IBAN"><input value={draft.bank_iban || ""} onChange={set("bank_iban")} /></LightField>
          </div>
        </LightFormSection>

        <LightFormSection title="Ziina Payment">
          <p className="text-[11px] text-slateText mb-3">Shown to players on the registration page when they select &quot;Ziina&quot; as their payment method — upload your Ziina QR scanner image.</p>
          <LightField label="Ziina QR Code Image" hint={ziinaQrFile?.name || (draft.ziina_qr_path ? "Leave blank to keep current image" : undefined)}>
            <input type="file" accept="image/*" className="text-xs !p-0" onChange={(e) => setZiinaQrFile(e.target.files?.[0] || null)} />
          </LightField>
        </LightFormSection>

        <LightFormSection title="Powered By">
          <p className="text-[11px] text-slateText mb-3">Shown as a small credit on the public homepage.</p>
          <LightField label="Powered By Name"><input value={draft.powered_by_name || ""} onChange={set("powered_by_name")} placeholder="e.g. Imperial Aura Events" /></LightField>
          <LightField label="Powered By Logo" hint={poweredByLogoFile?.name || (draft.powered_by_logo_path ? "Leave blank to keep current logo" : undefined)}>
            <input type="file" accept="image/*" className="text-xs !p-0" onChange={(e) => setPoweredByLogoFile(e.target.files?.[0] || null)} />
          </LightField>
        </LightFormSection>

        <LightFormSection title="Eligibility">
          <LightField label="Player Eligibility Mode">
            <select value={draft.eligibility_mode || "maharashtra_guest"} onChange={set("eligibility_mode")}>
              <option value="maharashtra_only">Maharashtra Players Only</option>
              <option value="maharashtra_guest">Maharashtra Players + Guest Indian Players</option>
            </select>
          </LightField>
          {draft.eligibility_mode === "maharashtra_guest" && (
            <LightField label="Guest Player Quota (per squad)" hint="Default: 3"><input type="number" value={draft.guest_quota ?? 3} onChange={setNum("guest_quota")} /></LightField>
          )}
          <div className="flex gap-6 mb-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slateText">
              <input type="checkbox" className="!w-auto" checked={!!draft.cricheroes_required} onChange={set("cricheroes_required")} /> CricHeroes profile mandatory
            </label>
            <label className="flex items-center gap-2 text-sm text-slateText">
              <input type="checkbox" className="!w-auto" checked={!!draft.emirates_id_required} onChange={set("emirates_id_required")} /> Valid Emirates ID mandatory
            </label>
          </div>
          <label className={`flex items-center gap-2 text-sm mb-4 text-slateText ${canToggleOverseas ? "" : "opacity-50"}`}>
            <input type="checkbox" className="!w-auto" checked={!!draft.allow_overseas_category} onChange={set("allow_overseas_category")} disabled={!canToggleOverseas} />
            Allow &quot;Overseas / Special Category&quot; classification (Super Admin only)
          </label>
          <LightField label="Player Eligibility Rules"><textarea value={draft.player_eligibility_rules || ""} onChange={set("player_eligibility_rules")} rows={3} /></LightField>
        </LightFormSection>

        <LightFormSection title="Auction">
          <LightField label="Auction Points per Team" hint="Virtual points only — no real currency is paid to players">
            <input type="number" value={draft.auction_points_per_team ?? 1000} onChange={setNum("auction_points_per_team")} />
          </LightField>
          {canEdit && (
            <div className="mb-4">
              <LightButton variant="subtle" size="sm" onClick={handleApplyPurseToAll} disabled={applyingPurse}>
                {applyingPurse ? "Applying…" : "Apply This Amount to All Existing Teams"}
              </LightButton>
              <p className="text-[11px] text-slateText mt-1.5">
                Changing the amount above only affects new teams. Click this to reset every existing team's purse to match — safe to use before the auction starts; if the auction is already underway, this overwrites any points already spent tracking, so double-check before using it mid-auction.
              </p>
              {purseMsg && <div className="text-xs mt-1 text-orange">{purseMsg}</div>}
            </div>
          )}
          <div className="w-full h-px my-4 bg-black/10" />
          <p className="text-[11px] text-slateText mb-3">Bidding in the Live Auction Control Room uses a single fixed step — no more custom bid amounts.</p>
          <div className="grid grid-cols-3 gap-3">
            <LightField label="Starting Bid" hint="First bid on any player">
              <input type="number" value={draft.auction_starting_bid ?? 1000} onChange={setNum("auction_starting_bid")} />
            </LightField>
            <LightField label="Bid Increment" hint="Added each time a team bids">
              <input type="number" value={draft.auction_bid_increment ?? 500} onChange={setNum("auction_bid_increment")} />
            </LightField>
            <LightField label="Maximum Bid" hint="Bidding stops here">
              <input type="number" value={draft.auction_max_bid ?? 25000} onChange={setNum("auction_max_bid")} />
            </LightField>
          </div>
        </LightFormSection>

        <LightFormSection title="About & Mission">
          <p className="text-[11px] text-slateText mb-3">Shown on the homepage — tell people what MTCC UAE is about.</p>
          <LightField label="About Text" hint="A paragraph or two introducing the tournament"><textarea value={draft.about_text || ""} onChange={set("about_text")} rows={4} /></LightField>
          <LightField label="Vision Statement"><textarea value={draft.vision_text || ""} onChange={set("vision_text")} rows={2} /></LightField>
          <LightField label="Mission Points" hint="One point per line — shown as a bulleted list"><textarea value={draft.mission_points || ""} onChange={set("mission_points")} rows={4} /></LightField>
        </LightFormSection>

        <LightFormSection title="Competition Rules">
          <LightField label="Qualification Rules"><textarea value={draft.qualification_rules || ""} onChange={set("qualification_rules")} /></LightField>
          <LightField label="Points Rules"><textarea value={draft.points_rules || ""} onChange={set("points_rules")} /></LightField>
          <LightField label="Net Run Rate Rules"><textarea value={draft.nrr_rules || ""} onChange={set("nrr_rules")} /></LightField>
          <LightField label="Tie / Super Over Rules"><textarea value={draft.tie_break_rules || ""} onChange={set("tie_break_rules")} /></LightField>
          <LightField label="General Tournament Rules" hint="One rule per line — shown as a numbered list on the public Rules page"><textarea value={draft.general_rules || ""} onChange={set("general_rules")} rows={5} /></LightField>
          <LightField label="Match Conditions" hint="Powerplay, no-ball, wide-ball, LBW/byes — whatever differs from standard play"><textarea value={draft.match_conditions_rules || ""} onChange={set("match_conditions_rules")} rows={5} /></LightField>
          <LightField label="Substitution Rules"><textarea value={draft.substitution_rules || ""} onChange={set("substitution_rules")} rows={3} /></LightField>
          <LightField label="Super Over Rules"><textarea value={draft.super_over_rules || ""} onChange={set("super_over_rules")} rows={3} /></LightField>
        </LightFormSection>

        <LightFormSection title="Terms & Conditions">
          <textarea value={draft.terms_and_conditions || ""} onChange={set("terms_and_conditions")} rows={5} />
        </LightFormSection>
      </fieldset>

      {canEdit && (
        <LightButton variant="primary" size="lg" className="w-full mt-2" onClick={handleSave} disabled={saving}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}
        </LightButton>
      )}
    </div>
  );
}
