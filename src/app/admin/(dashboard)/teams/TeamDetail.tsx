"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, FormSection } from "@/components/ui";
import { TEAM_PAYMENT_STATUSES } from "@/lib/constants";
import { updateTeam } from "./actions";

export default function TeamDetail({ team, settings, canManage, canEditFinance, onClose }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<any>(team);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setDraft((d: any) => ({ ...d, [k]: e.target.value }));

  async function uploadLogo(file: File) {
    const path = `${team.id}-${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (!error) setDraft((d: any) => ({ ...d, logo_path: path }));
  }
  async function uploadReceipt(file: File) {
    const path = `${team.id}-${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("payment-receipts").upload(path, file, { upsert: true });
    if (!error) setDraft((d: any) => ({ ...d, payment_receipt_path: path }));
  }

  async function handleSave() {
    setBusy(true);
    setErr("");
    const patch: any = {};
    if (canManage) {
      Object.assign(patch, {
        name: draft.name, logo_path: draft.logo_path, owner_name: draft.owner_name, company: draft.company,
        mobile: draft.mobile, whatsapp: draft.whatsapp, email: draft.email, manager: draft.manager,
        jersey_colour: draft.jersey_colour, notes: draft.notes,
      });
    }
    if (canEditFinance) {
      Object.assign(patch, {
        entry_fee_amount: Number(draft.entry_fee_amount), amount_paid: Number(draft.amount_paid || 0),
        payment_status: draft.payment_status, payment_reference: draft.payment_reference,
        payment_date: draft.payment_date, payment_receipt_path: draft.payment_receipt_path,
        auction_points: Number(draft.auction_points || 0),
      });
    }
    const res: any = await updateTeam(team.id, patch);
    setBusy(false);
    if (res.error) setErr(res.error);
    else { router.refresh(); onClose(); }
  }

  const readOnly = !canManage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-lineBright bg-bgPanel" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-line bg-bgPanel z-10">
          <h3 className="text-lg font-bold font-display">{team.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-bgCard text-muted">×</button>
        </div>
        <div className="p-5">
          {readOnly && <div className="p-3 mb-4 rounded-xl border text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>Read-only for your role.</div>}
          <fieldset disabled={readOnly} style={{ opacity: readOnly ? 0.6 : 1 }}>
            <Field label="Team Name"><input value={draft.name || ""} onChange={set("name")} /></Field>
            <Field label="Team Logo" hint={draft.logo_path || undefined}>
              <input type="file" accept="image/*" className="text-xs !p-0" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner Name"><input value={draft.owner_name || ""} onChange={set("owner_name")} /></Field>
              <Field label="Company"><input value={draft.company || ""} onChange={set("company")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mobile"><input value={draft.mobile || ""} onChange={set("mobile")} /></Field>
              <Field label="WhatsApp"><input value={draft.whatsapp || ""} onChange={set("whatsapp")} /></Field>
            </div>
            <Field label="Email"><input value={draft.email || ""} onChange={set("email")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Team Manager"><input value={draft.manager || ""} onChange={set("manager")} /></Field>
              <Field label="Jersey Colour"><input value={draft.jersey_colour || ""} onChange={set("jersey_colour")} /></Field>
            </div>
            <Field label="Notes"><textarea value={draft.notes || ""} onChange={set("notes")} /></Field>
          </fieldset>

          <fieldset disabled={!canEditFinance} style={{ opacity: canEditFinance ? 1 : 0.6 }}>
            <FormSection title="Financial Record">
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Team Entry Fee (${settings?.currency ?? "AED"})`}><input type="number" value={draft.entry_fee_amount ?? 1500} onChange={set("entry_fee_amount")} /></Field>
                <Field label={`Amount Paid (${settings?.currency ?? "AED"})`}><input type="number" value={draft.amount_paid ?? 0} onChange={set("amount_paid")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Status">
                  <select value={draft.payment_status} onChange={set("payment_status")}>{TEAM_PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                </Field>
                <Field label="Payment Reference"><input value={draft.payment_reference || ""} onChange={set("payment_reference")} /></Field>
              </div>
              <Field label="Payment Date"><input type="date" value={draft.payment_date || ""} onChange={set("payment_date")} /></Field>
              <Field label="Payment Receipt" hint={draft.payment_receipt_path || undefined}>
                <input type="file" className="text-xs !p-0" onChange={(e) => e.target.files?.[0] && uploadReceipt(e.target.files[0])} />
              </Field>
              <Field label="Auction Purse (points)" hint="This team's own starting purse — independent of the tournament-wide default in Settings">
                <input type="number" value={draft.auction_points ?? 1000} onChange={set("auction_points")} />
              </Field>
            </FormSection>
          </fieldset>

          {err && <div className="text-xs mb-3 text-red">{err}</div>}
          {(canManage || canEditFinance) && (
            <Button variant="primary" className="w-full" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : "Save Team"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
