"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";

type Mini = { id: string; full_name: string; role: string };

// Shows who is scoring this match and handles claim / hand-over / take-over.
// Only the scorer holding the seat can score; everyone else watches.
export default function ScorerBar({
  matchId, scorerId, scorerName, handoverTo, handoverToName, meId, roleOk, isSuperAdmin, matchOver,
}: {
  matchId: string; scorerId: string | null; scorerName: string | null;
  handoverTo: string | null; handoverToName: string | null;
  meId: string; roleOk: boolean; isSuperAdmin: boolean; matchOver: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState<Mini[]>([]);
  const [pick, setPick] = useState("");
  const [showSend, setShowSend] = useState(false);

  const iAmScorer = scorerId === meId;
  const sentToMe = handoverTo === meId;

  // Stay in sync when the scorer changes (realtime + a slow poll as a safety net).
  useEffect(() => {
    const ch = supabase
      .channel(`scorer-${matchId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => router.refresh())
      .subscribe();
    // The scorer already refreshes on every ball; viewers poll as a safety net.
    const t = iAmScorer ? null : setInterval(() => router.refresh(), 12000);
    return () => { supabase.removeChannel(ch); if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, iAmScorer]);

  useEffect(() => {
    if (!iAmScorer || !showSend) return;
    supabase.rpc("scoring_users").then(({ data }: any) => setUsers((data ?? []) as Mini[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iAmScorer, showSend]);

  async function call(fn: string, args: Record<string, any> = {}) {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc(fn, { p_match: matchId, ...args });
    setBusy(false);
    const res: any = data;
    if (error) { setErr(error.message); return false; }
    if (res?.error) { setErr(res.error); return false; }
    router.refresh();
    return true;
  }

  if (!roleOk) return null;

  // Nobody is scoring yet.
  if (!scorerId) {
    if (matchOver) return null;
    return (
      <Card className="p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold">Nobody is scoring this match</div>
          <div className="text-xs text-mutedDim">Start scoring to lock it to you. No one else can score it unless you send it to them.</div>
        </div>
        <Button size="sm" disabled={busy} onClick={() => call("claim_scoring")}>{busy ? "…" : "Start scoring"}</Button>
        {err && <div className="w-full text-xs text-red-500">{err}</div>}
      </Card>
    );
  }

  // I hold the seat.
  if (iAmScorer) {
    return (
      <Card className="p-3 mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm"><span className="font-bold">🟢 You are scoring this match</span></div>
          {!matchOver && (
            <div className="flex gap-2">
              {!handoverTo && <Button size="sm" variant="subtle" onClick={() => setShowSend(!showSend)}>{showSend ? "Close" : "Send scoring to…"}</Button>}
              <Button size="sm" variant="subtle" disabled={busy} onClick={() => { if (window.confirm("Release scoring? Anyone with scorer access will be able to start scoring this match.")) call("release_scoring"); }}>Release</Button>
            </div>
          )}
        </div>
        {handoverTo && (
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap text-xs">
            <span>Sent to <b>{handoverToName || "scorer"}</b>. Waiting for them to accept. You can keep scoring until they do.</span>
            <Button size="sm" variant="subtle" disabled={busy} onClick={() => call("cancel_handover")}>Cancel</Button>
          </div>
        )}
        {showSend && !handoverTo && (
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <select className="flex-1 min-w-[180px]" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a scorer…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
            <Button size="sm" disabled={!pick || busy} onClick={async () => { if (await call("send_scoring", { p_to: pick })) { setShowSend(false); setPick(""); } }}>Send</Button>
          </div>
        )}
        {err && <div className="mt-2 text-xs text-red-500">{err}</div>}
      </Card>
    );
  }

  // Someone else holds the seat.
  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm">
          🔒 <b>{scorerName || "Another scorer"}</b> is scoring this match.{" "}
          <span className="text-xs text-mutedDim">You can watch live but cannot score.</span>
        </div>
        {isSuperAdmin && !matchOver && (
          <Button size="sm" variant="subtle" disabled={busy} onClick={() => { if (window.confirm(`Take over scoring from ${scorerName || "the current scorer"}? They will immediately lose the ability to score.`)) call("take_over_scoring"); }}>
            Take over
          </Button>
        )}
      </div>
      {sentToMe && (
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap rounded-lg p-2" style={{ background: "rgba(212,175,55,0.12)" }}>
          <span className="text-sm"><b>{scorerName}</b> sent scoring to you.</span>
          <Button size="sm" disabled={busy} onClick={() => call("accept_scoring")}>Accept and start scoring</Button>
        </div>
      )}
      {err && <div className="mt-2 text-xs text-red-500">{err}</div>}
    </Card>
  );
}
