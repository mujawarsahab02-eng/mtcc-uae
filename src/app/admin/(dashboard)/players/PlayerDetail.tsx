"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LightBadge, LightButton, LightField, LightFormSection, LightStatusBadge } from "@/components/ui/light";
import {
  APPLICATION_STATUSES, PAYMENT_STATUSES, PLAYER_CATEGORIES, DOCUMENT_ACCESS_ROLES, PLAYER_DECISION_ROLES, computeAge,
  PLAYING_ROLES, BATTING_STYLES, PLAYER_TYPES, EMIRATES,
} from "@/lib/constants";
import { updatePlayer, deletePlayer, assignSpecialRole } from "./actions";
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
  const [teams, setTeams] = useState<any[]>([]);
  const [assignRole, setAssignRole] = useState(player.team_role || "Auction Player");
  const [assignTeamId, setAssignTeamId] = useState(player.team_id || "");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  const canViewDocs = DOCUMENT_ACCESS_ROLES.includes(currentRole);
  const canDecide = PLAYER_DECISION_ROLES.includes(currentRole) || currentRole === "Auction Admin";
  const canDelete = PLAYER_DECISION_ROLES.includes(currentRole);
  const canEditFinance = DOCUMENT_ACCESS_ROLES.includes(currentRole);
  const canAssignRole = PLAYER_DECISION_ROLES.includes(currentRole);
  const visibleCategories = PLAYER_CATEGORIES.filter(
    (c) => c !== "Overseas / Special Category" || (settings?.allow_overseas_category && currentRole === "Super Admin") || player.category === c
  );

  useState(() => {
    if (player.photo_path) {
      const { data } = supabase.storage.from("player-photos").getPublicUrl(player.photo_path);
      setPhotoUrl(data.publicUrl);
    }
  });

  useEffect(() => {
    supabase.from("teams").select("id, name").order("name").then(({ data }) => setTeams(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTeamName = teams.find((t) => t.id === player.team_id)?.name;

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

  async function handleAssign() {
    setAssigning(true);
    setAssignMsg("");
    const res: any = await assignSpecialRole(player.id, assignRole, assignRole === "Auction Player" ? null : assignTeamId || null);
    setAssigning(false);
    if (res.error) setAssignMsg(res.error);
    else {
      Object.assign(player, { team_role: assignRole, team_id: assignRole === "Auction Player" ? null : assignTeamId });
      setAssignMsg("Updated ✓");
      router.refresh();
      setTimeout(() => setAssignMsg(""), 2500);
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
            {player.team_role && player.team_role !== "Auction Player" && <LightBadge tone="gold">{player.team_role}</LightBadge>}
          </div>

          {photoUrl && <img src={photoUrl} alt="" className="w-20 h-20 rounded-full object-cover mb-4 border-2 border-gold" />}

          <Row label="Player ID" value={player.player_code} mono />

          <LightFormSection title="Player Details">
            <LightField label="Full Name">
              <input defaultValue={player.full_name || ""} onBlur={(e) => save({ full_name: e.target.value })} />
            </LightField>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="Date of Birth">
                <input type="date" defaultValue={player.dob || ""} onBlur={(e) => save({ dob: e.target.value || null })} />
              </LightField>
              <LightField label="Player Type">
                <select defaultValue={player.player_type || ""} onBlur={(e) => save({ player_type: e.target.value })}>
                  {PLAYER_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </LightField>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="Mobile Number">
                <input defaultValue={player.mobile || ""} onBlur={(e) => save({ mobile: e.target.value })} />
              </LightField>
              <LightField label="WhatsApp Number">
                <input defaultValue={player.whatsapp || ""} onBlur={(e) => save({ whatsapp: e.target.value })} />
              </LightField>
            </div>
            <LightField label="Email Address">
              <input defaultValue={player.email || ""} onBlur={(e) => save({ email: e.target.value })} />
            </LightField>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="Emirate">
                <select defaultValue={player.emirate || ""} onBlur={(e) => save({ emirate: e.target.value })}>
                  <option value="">Select</option>
                  {EMIRATES.map((e) => <option key={e}>{e}</option>)}
                </select>
              </LightField>
              <LightField label="UAE Location">
                <input defaultValue={player.uae_location || ""} onBlur={(e) => save({ uae_location: e.target.value })} />
              </LightField>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="District">
                <input defaultValue={player.district || ""} onBlur={(e) => save({ district: e.target.value || null })} />
              </LightField>
              <LightField label="State">
                <input defaultValue={player.state || ""} onBlur={(e) => save({ state: e.target.value || null })} />
              </LightField>
            </div>
          </LightFormSection>

          <LightFormSection title="Cricket Details">
            <LightField label="CricHeroes Profile Link">
              <input defaultValue={player.cricheroes_url || ""} onBlur={(e) => save({ cricheroes_url: e.target.value })} />
            </LightField>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="Playing Role">
                <select defaultValue={player.playing_role || ""} onBlur={(e) => save({ playing_role: e.target.value })}>
                  {PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </LightField>
              <LightField label="Batting Style">
                <select defaultValue={player.batting_style || ""} onBlur={(e) => save({ batting_style: e.target.value })}>
                  {BATTING_STYLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </LightField>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <LightField label="Bowling Style">
                <input defaultValue={player.bowling_style || ""} onBlur={(e) => save({ bowling_style: e.target.value })} />
              </LightField>
              <LightField label="Preferred Batting Position">
                <input defaultValue={player.batting_position || ""} onBlur={(e) => save({ batting_position: e.target.value })} />
              </LightField>
            </div>
            <LightField label="Current Team (as entered at registration)">
              <input defaultValue={player.current_team || ""} onBlur={(e) => save({ current_team: e.target.value })} />
            </LightField>
          </LightFormSection>

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

          <LightFormSection title="T-Shirt Details">
            <div className="grid grid-cols-3 gap-3">
              <LightField label="Size">
                <input defaultValue={player.tshirt_size ?? ""} onBlur={(e) => save({ tshirt_size: e.target.value || null })} />
              </LightField>
              <LightField label="Name on Shirt">
                <input defaultValue={player.tshirt_name ?? ""} onBlur={(e) => save({ tshirt_name: e.target.value || null })} />
              </LightField>
              <LightField label="Number on Shirt">
                <input defaultValue={player.tshirt_number ?? ""} onBlur={(e) => save({ tshirt_number: e.target.value || null })} />
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
              <div className="space-y-2">
                <LightField label="Emirates ID Number">
                  <input defaultValue={player.emirates_id || ""} onBlur={(e) => save({ emirates_id: e.target.value })} />
                </LightField>
                <LightField label="Emirates ID Expiry">
                  <input type="date" defaultValue={player.emirates_id_expiry || ""} onBlur={(e) => save({ emirates_id_expiry: e.target.value || null })} />
                </LightField>
                <div className="text-xs text-slateText">
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

          {canAssignRole && (
            <LightFormSection title="Team Role & Assignment (Bypass Auction)">
              <p className="text-[11px] text-slateText mb-3">
                Assign this player directly to a team as Owner (fixed {settings?.owner_fixed_points ?? 5000} pts, deducted from that team&apos;s purse) or Captain/Icon (free) —
                they will never appear in the live auction pool. Both still count toward the squad size.
                {currentTeamName && <span className="block mt-1 font-semibold text-navyText">Currently on: {currentTeamName} ({player.team_role})</span>}
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <LightField label="Role">
                  <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                    <option value="Auction Player">Auction Player (normal)</option>
                    <option value="Owner">Owner</option>
                    <option value="Captain/Icon">Captain/Icon</option>
                  </select>
                </LightField>
                {assignRole !== "Auction Player" && (
                  <LightField label="Team">
                    <select value={assignTeamId} onChange={(e) => setAssignTeamId(e.target.value)}>
                      <option value="">Select team</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </LightField>
                )}
              </div>
              {assignMsg && <div className="text-xs mb-2 text-green">{assignMsg}</div>}
              <LightButton variant="primary" size="sm" onClick={handleAssign} disabled={assigning}>
                {assigning ? "Saving…" : "Apply"}
              </LightButton>
            </LightFormSection>
          )}

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
    <div className="flex justify-between py-1.5 border-b border-black/5 text-sm mb-2">
      <span className="text-slateText">{label}</span>
      <span className={`text-navyText ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
    </div>
  );
}
