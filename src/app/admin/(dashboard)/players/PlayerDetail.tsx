"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Field, FormSection, StatusBadge } from "@/components/ui";
import { APPLICATION_STATUSES, PAYMENT_STATUSES, PLAYER_CATEGORIES, DOCUMENT_ACCESS_ROLES, PLAYER_DECISION_ROLES } from "@/lib/constants";
import { updatePlayer } from "./actions";
import { createClient } from "@/lib/supabase/client";

export default function PlayerDetail({ player, settings, categories, currentRole, onClose }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [notes, setNotes] = useState(player.internal_notes || "");
  const [showId, setShowId] = useState(false);
  const [idUrl, setIdUrl] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canViewDocs = DOCUMENT_ACCESS_ROLES.includes(currentRole);
  const canDecide = PLAYER_DECISION_ROLES.includes(currentRole) || currentRole === "Auction Admin";
  const canEditFinance = DOCUMENT_ACCESS_ROLES.includes(currentRole);
  const visibleCategories = PLAYER_CATEGORIES.filter(
    (c) => c !== "Overseas / Special Category" || (settings?.allow_overseas_category && currentRole === "Super Admin") || player.category === c
  );

  useState(() => {
    if (player.photo_path) {
      const { data } = supabase.storage.from("player-photos").getPublicUrl(player.photo_path);
      setPhotoUrl(data.publicUrl);
    }
  });

  async function save(patch: Record<string, any>, action?: string) {
    setBusy(true);
    setErr("");
    const res = await updatePlayer(player.id, patch, action);
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      Object.assign(player, patch);
      router.refresh();
    }
  }

  async function fetchSignedUrl(bucket: string, path: string, setter: (u: string) => void) {
    const res = await fetch("/api/documents/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path }),
    });
    const data = await res.json();
    if (data.url) setter(data.url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-lineBright bg-bgPanel" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-line bg-bgPanel z-10">
          <h3 className="text-lg font-bold font-display">{player.full_name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-bgCard text-muted">×</button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 flex-wrap mb-4">
            <StatusBadge status={player.application_status} />
            <StatusBadge status={player.payment_status} />
            <Badge tone="default">{player.category}</Badge>
            {player.auction_category && <Badge tone="orange">{player.auction_category}</Badge>}
            {player.player_type && <Badge tone="blue">{player.player_type}</Badge>}
          </div>

          {photoUrl && <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover mb-4 border-2 border-gold" />}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-5">
            <Row label="Player ID" value={player.player_code} mono />
            <Row label="Role" value={player.playing_role} />
            <Row label="Batting Style" value={player.batting_style} />
            <Row label="Bowling Style" value={player.bowling_style} />
            <Row label="District" value={player.district} />
            <Row label="State" value={player.state} />
            <Row label="Emirate" value={player.emirate} />
            <Row label="Mobile" value={player.mobile} />
            <Row label="WhatsApp" value={player.whatsapp} />
            <Row label="Email" value={player.email} />
          </div>

          {player.cricheroes_url && (
            <a href={player.cricheroes_url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline block mb-4 text-blue">
              Open CricHeroes Profile ↗
            </a>
          )}

          <div className="p-3 mb-4 rounded-xl border" style={{ background: "rgba(78,155,255,0.06)", borderColor: "rgba(78,155,255,0.25)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-blue">Restricted: Emirates ID</span>
              {canViewDocs ? (
                <button
                  onClick={async () => {
                    if (!showId && player.emirates_id_path) await fetchSignedUrl("emirates-ids", player.emirates_id_path, setIdUrl);
                    setShowId(!showId);
                  }}
                  className="text-[11px] font-semibold underline text-blue"
                >
                  {showId ? "Hide" : "Show (Authorised Only)"}
                </button>
              ) : (
                <span className="text-[11px] text-mutedDim">Not visible to {currentRole}</span>
              )}
            </div>
            {showId && canViewDocs && (
              <div className="text-xs space-y-1 text-muted">
                <div>Number: {player.emirates_id || "—"}</div>
                <div>Expiry: {player.emirates_id_expiry || "—"}</div>
                <div>
                  Copy on file:{" "}
                  {idUrl ? <a href={idUrl} target="_blank" rel="noreferrer" className="underline font-semibold text-blue">View (link expires in 2 min)</a> : "Not uploaded"}
                </div>
              </div>
            )}
          </div>

          {canViewDocs ? (
            player.payment_receipt_path && (
              <div className="text-xs mb-4 text-muted">
                Payment receipt on file:{" "}
                <button onClick={() => fetchSignedUrl("payment-receipts", player.payment_receipt_path, setReceiptUrl)} className="underline font-semibold text-blue">
                  {receiptUrl ? "" : "Generate link"}
                </button>
                {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="underline font-semibold text-blue">Open receipt</a>}
                {" "}({player.payment_reference || "no ref"})
              </div>
            )
          ) : (
            <div className="text-xs mb-4 text-mutedDim">Payment documents are only visible to Super Admin, Tournament Admin and Finance Admin.</div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Field label="Application Status">
              <select value={player.application_status} disabled={!canDecide || busy}
                onChange={(e) => save({ application_status: e.target.value }, "Application Status Changed")}>
                {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Payment Status">
              <select value={player.payment_status} disabled={!canEditFinance || busy}
                onChange={(e) => {
                  const val = e.target.value;
                  const patch: any = { payment_status: val };
                  if (val === "Verified" && !player.payment_date) patch.payment_date = new Date().toISOString().slice(0, 10);
                  save(patch, "Payment Status Changed");
                }}>
                {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Player Category">
              <select value={player.category} disabled={!canDecide || busy} onChange={(e) => save({ category: e.target.value }, "Player Category Changed")}>
                {visibleCategories.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Auction Category">
              <select value={player.auction_category || ""} disabled={!canDecide || busy} onChange={(e) => save({ auction_category: e.target.value || null }, "Auction Category Changed")}>
                <option value="">Unassigned</option>
                {categories.map((c: string) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {canEditFinance && (
            <FormSection title="Financial Record">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={`Registration Fee (${settings?.currency ?? "AED"})`}>
                  <input type="number" defaultValue={player.registration_fee_amount ?? settings?.player_reg_fee} onBlur={(e) => save({ registration_fee_amount: Number(e.target.value) })} />
                </Field>
                <Field label={`Amount Paid (${settings?.currency ?? "AED"})`}>
                  <input type="number" defaultValue={player.amount_paid ?? 0} onBlur={(e) => save({ amount_paid: Number(e.target.value) })} />
                </Field>
                <Field label="Payment Reference">
                  <input defaultValue={player.payment_reference || ""} onBlur={(e) => save({ payment_reference: e.target.value })} />
                </Field>
                <Field label="Payment Date">
                  <input type="date" defaultValue={player.payment_date || ""} onBlur={(e) => save({ payment_date: e.target.value })} />
                </Field>
              </div>
            </FormSection>
          )}

          <Field label="Internal Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => save({ internal_notes: notes })} rows={3} />
          </Field>

          {err && <div className="text-xs mb-3 text-red">{err}</div>}

          {canDecide && (
            <div className="flex gap-2 mt-4">
              <Button variant="primary" size="sm" onClick={() => save({ application_status: "Approved for Auction" }, "Player Approved")} disabled={busy}>Approve</Button>
              <Button variant="danger" size="sm" onClick={() => save({ application_status: "Rejected" }, "Player Rejected")} disabled={busy}>Reject</Button>
            </div>
          )}
          {!canDecide && <div className="text-xs mt-2 text-mutedDim">Your role ({currentRole}) cannot approve or reject players.</div>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-line">
      <span className="text-mutedDim">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value || "—"}</span>
    </div>
  );
}
