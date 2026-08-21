"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LightCard, LightSectionHeader, LightSeamDivider, LightStatusBadge } from "@/components/ui/light";
import { SETTINGS_EDIT_ROLES, DOCUMENT_ACCESS_ROLES } from "@/lib/constants";
import TeamDetail from "./TeamDetail";

export default function TeamsClient({ initialTeams, settings, currentRole }: any) {
  const supabase = createClient();
  const [teams, setTeams] = useState(initialTeams);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const channel = supabase
      .channel("teams-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (payload) => {
        setTeams((prev: any[]) => {
          if (payload.eventType === "INSERT") return [...prev, payload.new];
          if (payload.eventType === "UPDATE") return prev.map((t) => (t.id === payload.new.id ? payload.new : t));
          if (payload.eventType === "DELETE") return prev.filter((t) => t.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const canManage = SETTINGS_EDIT_ROLES.includes(currentRole);
  const canEditFinance = DOCUMENT_ACCESS_ROLES.includes(currentRole);

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title={`Team Owners (${teams.length})`} />
      <LightSeamDivider />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {teams.map((t: any) => (
          <LightCard key={t.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(t)}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 border" style={{ background: "#FBF1D6", color: "#8A6A0A", borderColor: "rgba(212,175,55,0.3)" }}>
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate font-display text-navyText">{t.name}</div>
                <div className="text-[11px] truncate text-slateText">{t.owner_name || "No owner assigned"}</div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <LightStatusBadge status={t.payment_status} />
              <span className="text-xs font-mono text-slateText">{settings?.currency ?? "AED"} {t.entry_fee_amount}</span>
            </div>
          </LightCard>
        ))}
      </div>

      {selected && (
        <TeamDetail team={selected} settings={settings} canManage={canManage} canEditFinance={canEditFinance} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
