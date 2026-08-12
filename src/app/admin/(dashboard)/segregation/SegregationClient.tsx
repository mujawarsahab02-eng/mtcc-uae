"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, SectionHeader, SeamDivider, Button } from "@/components/ui";
import { PLAYING_ROLES, SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { addCategory, removeCategory } from "./actions";
import { updatePlayer } from "../players/actions";

export default function SegregationClient({ initialPlayers, initialCategories, currentRole }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [players, setPlayers] = useState(initialPlayers);
  const [categories, setCategories] = useState(initialCategories);
  const [newCat, setNewCat] = useState("");
  const canManage = SETTINGS_EDIT_ROLES.includes(currentRole);

  useEffect(() => {
    const channel = supabase
      .channel("segregation-players")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload: any) => {
        setPlayers((prev: any[]) => {
          const row = payload.new;
          if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== payload.old.id);
          if (row.application_status !== "Approved for Auction") return prev.filter((p) => p.id !== row.id);
          const exists = prev.some((p) => p.id === row.id);
          return exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const byRole = useMemo(() => {
    const groups: Record<string, any[]> = {};
    PLAYING_ROLES.forEach((r) => (groups[r] = players.filter((p: any) => p.playing_role === r)));
    groups["Guest Player"] = players.filter((p: any) => p.category === "Guest Player");
    groups["Maharashtra Player"] = players.filter((p: any) => p.category === "Maharashtra Player");
    return groups;
  }, [players]);

  const byCategory = useMemo(() => {
    const groups: Record<string, any[]> = { Unassigned: players.filter((p: any) => !p.auction_category) };
    categories.forEach((c: string) => (groups[c] = players.filter((p: any) => p.auction_category === c)));
    return groups;
  }, [players, categories]);

  async function movePlayer(id: string, cat: string) {
    setPlayers((prev: any[]) => prev.map((p) => (p.id === id ? { ...p, auction_category: cat || null } : p)));
    await updatePlayer(id, { auction_category: cat || null }, "Auction Category Changed");
  }
  async function handleAddCategory() {
    if (!newCat.trim() || categories.includes(newCat.trim())) return;
    setCategories((c: string[]) => [...c, newCat.trim()]);
    await addCategory(newCat.trim());
    setNewCat("");
    router.refresh();
  }
  async function handleRemoveCategory(c: string) {
    setCategories((prev: string[]) => prev.filter((x) => x !== c));
    await removeCategory(c);
    router.refresh();
  }

  return (
    <div>
      <SectionHeader eyebrow="Pre-Auction" title="Player Segregation" />
      <SeamDivider />

      <Card className="p-4 my-5">
        <div className="text-xs font-bold uppercase tracking-wide mb-3 text-muted">Auto Grouping (Approved Players)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(byRole).map(([k, v]) => (
            <div key={k} className="p-3 rounded-lg text-center bg-bgPanel border border-line">
              <div className="text-xl font-bold text-gold font-display">{(v as any[]).length}</div>
              <div className="text-[10px] uppercase mt-1 text-mutedDim">{k}</div>
            </div>
          ))}
        </div>
      </Card>

      {canManage && (
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Auction Categories (Configurable)</div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category e.g. A+" style={{ width: 160 }} />
              <Button variant="orange" size="sm" onClick={handleAddCategory}>Add</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c: string) => (
              <span key={c} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 bg-bgPanel border border-lineBright text-goldBright">
                {c} <button onClick={() => handleRemoveCategory(c)} className="text-mutedDim">×</button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {players.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mutedDim">No players approved for auction yet. Approve players from Player Management.</Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([cat, list]) => (
            <Card key={cat} className="p-4">
              <div className="text-sm font-bold mb-3 flex items-center justify-between font-display">
                <span>{cat}</span><Badge tone="gold">{(list as any[]).length} players</Badge>
              </div>
              {(list as any[]).length === 0 && <div className="text-xs text-mutedDim">No players in this category.</div>}
              <div className="space-y-2">
                {(list as any[]).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 flex-wrap gap-2 border-line">
                    <div>
                      <span className="text-sm font-semibold">{p.full_name}</span>
                      <span className="text-[11px] ml-2 text-mutedDim">{p.playing_role} · {p.district || p.category}</span>
                    </div>
                    <select value={p.auction_category || ""} onChange={(e) => movePlayer(p.id, e.target.value)} style={{ width: 160 }}>
                      <option value="">Unassigned</option>
                      {categories.map((c: string) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
