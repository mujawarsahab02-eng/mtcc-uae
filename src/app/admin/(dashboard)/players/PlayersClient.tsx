"use client";

import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LightButton, LightCard, LightSectionHeader, LightSeamDivider, LightStatCard, LightStatusBadge } from "@/components/ui/light";
import { PLAYING_ROLES, APPLICATION_STATUSES, PAYMENT_STATUSES, PLAYER_CATEGORIES } from "@/lib/constants";
import PlayerDetail from "./PlayerDetail";

export default function PlayersClient({ initialPlayers, settings, categories, currentRole }: any) {
  const supabase = createClient();
  const [players, setPlayers] = useState(initialPlayers);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);

  // Live updates: if Auction/Finance/another admin changes a player elsewhere,
  // this list reflects it immediately (item: central database requirement).
  useEffect(() => {
    const channel = supabase
      .channel("players-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        setPlayers((prev: any[]) => {
          if (payload.eventType === "INSERT") return [payload.new, ...prev];
          if (payload.eventType === "UPDATE") return prev.map((p) => (p.id === payload.new.id ? payload.new : p));
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const filtered = useMemo(() => {
    return players.filter((p: any) => {
      if (q && !`${p.full_name} ${p.player_code} ${p.district}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (roleFilter && p.playing_role !== roleFilter) return false;
      if (statusFilter && p.application_status !== statusFilter) return false;
      if (payFilter && p.payment_status !== payFilter) return false;
      if (catFilter && p.category !== catFilter) return false;
      return true;
    });
  }, [players, q, roleFilter, statusFilter, payFilter, catFilter]);

  const stats = useMemo(() => ({
    total: players.length,
    fees: players.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0),
    pending: players.filter((p: any) => p.payment_status === "Pending").length,
    approved: players.filter((p: any) => p.application_status === "Approved for Auction").length,
    sold: players.filter((p: any) => p.application_status === "Sold / Selected").length,
    unsold: players.filter((p: any) => p.application_status === "Unsold / Not Selected").length,
    batsmen: players.filter((p: any) => p.playing_role === "Batsman").length,
    bowlers: players.filter((p: any) => p.playing_role === "Bowler").length,
    allrounders: players.filter((p: any) => p.playing_role === "All-Rounder").length,
    keepers: players.filter((p: any) => p.playing_role === "Wicketkeeper-Batsman").length,
    guests: players.filter((p: any) => p.category === "Guest Player").length,
  }), [players]);

  function exportCSV() {
    const cols = ["player_code", "full_name", "playing_role", "district", "mobile", "cricheroes_url", "category", "application_status", "payment_status"];
    const rows = [cols.join(",")].concat(filtered.map((p: any) => cols.map((c) => `"${(p[c] ?? "").toString().replace(/"/g, '""')}"`).join(",")));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mtcc_players.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title="Player Management" action={<LightButton variant="ghost" onClick={exportCSV}>Export CSV</LightButton>} />
      <LightSeamDivider />

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 my-5">
        <LightStatCard label="Total" value={stats.total} tone="gold" />
        <LightStatCard label="Fees Collected" value={`${settings?.currency ?? "AED"} ${stats.fees}`} tone="gold" />
        <LightStatCard label="Payment Pending" value={stats.pending} tone="red" />
        <LightStatCard label="Approved" value={stats.approved} tone="green" />
        <LightStatCard label="Sold" value={stats.sold} tone="green" />
        <LightStatCard label="Unsold" value={stats.unsold} tone="default" />
        <LightStatCard label="Batsmen" value={stats.batsmen} tone="blue" />
        <LightStatCard label="Bowlers" value={stats.bowlers} tone="blue" />
        <LightStatCard label="All-Rounders" value={stats.allrounders} tone="blue" />
        <LightStatCard label="Wicketkeepers" value={stats.keepers} tone="blue" />
        <LightStatCard label="Guest Players" value={stats.guests} tone="orange" />
      </div>

      <LightCard className="p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input placeholder="Search name, ID, district…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-[160px]" style={{ maxWidth: 260 }} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All Roles</option>{PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 190 }}>
            <option value="">All Statuses</option>{APPLICATION_STATUSES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All Payments</option>{PAYMENT_STATUSES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ maxWidth: 190 }}>
            <option value="">All Categories</option>{PLAYER_CATEGORIES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </LightCard>

      <div className="space-y-2">
        {filtered.length === 0 && <LightCard className="p-8 text-center text-sm text-slateText">No players match these filters.</LightCard>}
        {filtered.map((p: any) => (
          <LightCard key={p.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "#FBF1D6", color: "#8A6A0A" }}>
                  {(p.full_name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navyText truncate">{p.full_name || "Unnamed"}</div>
                  <div className="text-[11px] flex gap-2 flex-wrap text-slateText font-mono">
                    <span>{p.player_code}</span><span>·</span><span>{p.playing_role}</span>
                    {p.district && <><span>·</span><span>{p.district}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <LightStatusBadge status={p.payment_status} />
                <LightStatusBadge status={p.application_status} />
              </div>
            </div>
          </LightCard>
        ))}
      </div>

      {selected && (
        <PlayerDetail
          player={selected}
          settings={settings}
          categories={categories}
          currentRole={currentRole}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
