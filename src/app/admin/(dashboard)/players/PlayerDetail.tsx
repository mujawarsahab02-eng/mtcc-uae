"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LightBadge, LightButton, LightField, LightFormSection, LightStatusBadge } from "@/components/ui/light";
import { APPLICATION_STATUSES, PAYMENT_STATUSES, PLAYER_CATEGORIES, DOCUMENT_ACCESS_ROLES, PLAYER_DECISION_ROLES, computeAge } from "@/lib/constants";
import { updatePlayer, deletePlayer } from "./actions";
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
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  const canViewDocs = DOCUMENT_ACCESS_ROLES.includes(currentRole);
  const canDecide = PLAYER_DECISION_ROLES.includes(currentRole) || currentRole === "Auction Admin";
  const canDelete = PLAYER_DECISION_ROLES.includes(currentRole);
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
    const res: any = await updatePlayer(player.id, patch, action);
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      Object.assign(player, patch);
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Permanently delete ${player.full_name}'s registration? This cannot be undone.`)) return;
    setDeleting(true);
    setErr("");
    const res: any = await deletePlayer(player.id);
    setDeleting(false);
    if (res.error) setErr(res.error);
    else { router.refresh(); onClose(); }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-black/10 bg-white light-form" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-black/10 bg-white z-10">
          <h3 className="text-lg font-bold font-display text-navyText">{player.full_name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F2F4] text-slateText">×</button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 flex-wrap mb-4">
            <LightStatusBadge status={player.application_status} />
            <LightStatusBadge status={player.payment_status} />
            <LightBadge tone="default">{player.category}</LightBadge>
            {player.auction_category && <LightBadge tone="orange">{player.auction_category}</LightBadge>}
            {player.player_type && <LightBadge tone="blue">{player.player_type}</LightBadge>}
          </div>

          {photoUrl && <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover mb-4 border-2 border-gold" />}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-5">
            <Row label="Player ID" value={player.player_code} mono />
            <Row label="Age" value={computeAge(player.dob) != null ? `${computeAge(player.dob)}` : undefined} />
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

          <LightFormSection title="CricHeroes Stats">
            <p className="text-[11px] text-slateText mb-3">Read these off the player&apos;s CricHeroes profile yourself — never taken from what the player types in.</p>
            <div className="grid grid-cols-3 gap-3">
              <LightField label="Matches">
                <input type="number" defaultValue={player.cricheroes_matches ?? ""} onBlur={(e) => save({ cricheroes_matches: e.target.value ? Number(e.target.value) : null })} />
              </LightField>
              <LightField label="Runs">
                <input type="number" defaultValue={player.cricheroes_runs ?? ""} onBlur={(e) => save({ cricheroes_runs: e.target.value ? Number(e.target.value) : null })} />
              </LightField>
              <LightField label="Wickets">
                <input type="number" defaultValue={player.cricheroes_wickets ?? ""} onBlur={(e) => save({ cricheroes_wickets: e.target.value ? Number(e.target.value) : null })} />
              </LightField>
            </div>
          </LightFormSection>

          <div className="p-3 mb-4 rounded-xl border" style={{ background: "rgba(78,155,255,0.06)", borderColor: "rgba(78,155,255,0.2)" }}>
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
                <span className="text-[11px] text-slateText">Not visible to {currentRole}</span>
              )}
            </div>
            {showId && canViewDocs && (
              <div className="text-xs space-y-1 text-slateText">
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
              <div className="text-xs mb-4 text-slateText">
                Payment receipt on file:{" "}
                <button onClick={() => fetchSignedUrl("payment-receipts", player.payment_receipt_path, setReceiptUrl)} className="underline font-semibold text-blue">
                  {receiptUrl ? "" : "Generate link"}
                </button>
                {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="underline font-semibold text-blue">Open receipt</a>}
                {" "}({player.payment_reference || "no ref"})
              </div>
            )
          ) : (
            <div className="text-xs mb-4 text-slateText">Payment documents are only visible to Super Admin, Tournament Admin and Finance Admin.</div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <LightField label="Application Status">
              <select value={player.application_status} disabled={!canDecide || busy}
                onChange={(e) => save({ application_status: e.target.value }, "Application Status Changed")}>
                {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LightField>
            <LightField label="Payment Status">
              <select value={player.payment_status} disabled={!canEditFinance || busy}
                onChange={(e) => {
                  const val = e.target.value;
                  const patch: any = { payment_status: val };
                  if (val === "Verified" && !player.payment_date) patch.payment_date = new Date().toISOString().slice(0, 10);
                  save(patch, "Payment Status Changed");
                }}>
                {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LightField>
            <LightField label="Player Category">
              <select value={player.category} disabled={!canDecide || busy} onChange={(e) => save({ category: e.target.value }, "Player Category Changed")}>
                {visibleCategories.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LightField>
            <LightField label="Auction Category">
              <select value={player.auction_category || ""} disabled={!canDecide || busy} onChange={(e) => save({ auction_category: e.target.value || null }, "Auction Category Changed")}>
                <option value="">Unassigned</option>
                {categories.map((c: string) => <option key={c}>{c}</option>)}
              </select>
            </LightField>
          </div>

          {canEditFinance && (
            <LightFormSection title="Financial Record">
              <div className="grid sm:grid-cols-2 gap-3">
                <LightField label={`Registration Fee (${settings?.currency ?? "AED"})`}>
                  <input type="number" defaultValue={player.registration_fee_amount ?? settings?.player_reg_fee} onBlur={(e) => save({ registration_fee_amount: Number(e.target.value) })} />
                </LightField>
                <LightField label={`Amount Paid (${settings?.currency ?? "AED"})`}>
                  <input type="number" defaultValue={player.amount_paid ?? 0} onBlur={(e) => save({ amount_paid: Number(e.target.value) })} />
                </LightField>
                <LightField label="Payment Reference">
                  <input defaultValue={player.payment_reference || ""} onBlur={(e) => save({ payment_reference: e.target.value })} />
                </LightField>
                <LightField label="Payment Date">
                  <input type="date" defaultValue={player.payment_date || ""} onBlur={(e) => save({ payment_date: e.target.value })} />
                </LightField>
              </div>
            </LightFormSection>
          )}

          <LightField label="Internal Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => save({ internal_notes: notes })} rows={3} />
          </LightField>

          {err && <div className="text-xs mb-3 text-red">{err}</div>}

          {canDecide && (
            <div className="flex gap-2 mt-4">
              <LightButton variant="primary" size="sm" onClick={() => save({ application_status: "Approved for Auction" }, "Player Approved")} disabled={busy}>Approve</LightButton>
              <LightButton variant="danger" size="sm" onClick={() => save({ application_status: "Rejected" }, "Player Rejected")} disabled={busy}>Reject</LightButton>
            </div>
          )}
          {!canDecide && <div className="text-xs mt-2 text-slateText">Your role ({currentRole}) cannot approve or reject players.</div>}

          {canDelete && (
            <div className="mt-6 pt-4 border-t border-black/10">
              <div className="text-[11px] font-bold uppercase tracking-wide mb-2 text-red">Danger Zone</div>
              <LightButton variant="danger" size="sm" onClick={handleDelete} disabled={deleting || busy}>
                {deleting ? "Deleting…" : "Delete Player Registration"}
              </LightButton>
              <p className="text-[11px] mt-1.5 text-slateText">Permanently removes this player. Blocked if they've already been sold to a team.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-black/5">
      <span className="text-slateText">{label}</span>
      <span className={`text-navyText ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
    </div>
  );
}
