"use client";

import { useState } from "react";
import { LightBadge, LightButton, LightCard, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";

export default function SquadsClient({ teams, players, settings }: any) {
  const [previewTeam, setPreviewTeam] = useState<any>(null);

  const squadFor = (teamId: string) => players.filter((p: any) => p.team_id === teamId);

  function exportAllCSV() {
    const cols = ["teamName", "playerCode", "playerName", "role", "category", "soldPoints"];
    const rows = [cols.join(",")];
    teams.forEach((t: any) => {
      squadFor(t.id).forEach((p: any) => {
        rows.push([t.name, p.player_code, p.full_name, p.playing_role, p.category, p.sold_points].map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mtcc_final_squads.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function printSquad(team: any) {
    const squad = squadFor(team.id);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${team.name} — Squad</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{margin-bottom:4px}.sub{color:#666;margin-bottom:20px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}th{background:#111;color:#fff}</style>
      </head><body>
      <h1>${team.name}</h1>
      <div class="sub">${settings?.tournament_name ?? ""} · Owner: ${team.owner_name || "—"} · ${squad.length} players</div>
      <table><thead><tr><th>#</th><th>Player</th><th>Role</th><th>Category</th><th>Points</th></tr></thead><tbody>
      ${squad.map((p: any, i: number) => `<tr><td>${i + 1}</td><td>${p.full_name}</td><td>${p.playing_role}</td><td>${p.category}</td><td>${p.sold_points}</td></tr>`).join("")}
      </tbody></table></body></html>
    `);
    w.document.close();
    w.print();
  }

  // Deliberately kept dark/gold — this renders a shareable branded graphic
  // asset (PNG export), not admin page UI, so it stays cinematic regardless
  // of the admin panel's light refresh.
  function downloadSquadImage(team: any) {
    const squad = squadFor(team.id);
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0F1729"); grad.addColorStop(1, "#0A0F1C");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 6; ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = "#FF7A3D"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
    ctx.fillText(settings?.season?.toUpperCase() || "", canvas.width / 2, 100);

    ctx.fillStyle = "#F5F7FA"; ctx.font = "bold 54px Arial";
    ctx.fillText(team.name.toUpperCase(), canvas.width / 2, 170);

    ctx.fillStyle = "#8B98B5"; ctx.font = "22px Arial";
    ctx.fillText(settings?.tournament_name ?? "", canvas.width / 2, 250);

    ctx.strokeStyle = "#22304F"; ctx.beginPath(); ctx.moveTo(80, 285); ctx.lineTo(canvas.width - 80, 285); ctx.stroke();

    let y = 340;
    ctx.textAlign = "left";
    squad.forEach((p: any, i: number) => {
      ctx.fillStyle = "#D4AF37"; ctx.font = "bold 26px Arial";
      ctx.fillText(String(i + 1).padStart(2, "0"), 90, y);
      ctx.fillStyle = "#F5F7FA"; ctx.font = "bold 28px Arial";
      ctx.fillText(p.full_name, 150, y);
      ctx.fillStyle = "#8B98B5"; ctx.font = "20px Arial";
      ctx.fillText(p.playing_role, 150, y + 28);
      y += 68;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#5C6989"; ctx.font = "18px Arial";
    ctx.fillText(`${squad.length} Players · Official Squad Card`, canvas.width / 2, canvas.height - 50);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `${team.name.replace(/\s+/g, "_")}_squad_card.png`; a.click();
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Post-Auction" title="Final Team Squads" action={<LightButton variant="ghost" onClick={exportAllCSV}>Export All (CSV)</LightButton>} />
      <LightSeamDivider />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {teams.map((t: any) => {
          const squad = squadFor(t.id);
          return (
            <LightCard key={t.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPreviewTeam(t)}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold font-display text-navyText">{t.name}</div>
                <LightBadge tone="gold">{squad.length}/{settings?.max_squad_size ?? 14}</LightBadge>
              </div>
              <div className="text-[11px] mb-2 text-slateText">{t.owner_name || "No owner assigned"}</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {squad.slice(0, 5).map((p: any) => <div key={p.id} className="text-xs text-navyText">{p.full_name} <span className="text-slateText">· {p.playing_role}</span></div>)}
                {squad.length > 5 && <div className="text-[11px] text-slateText">+{squad.length - 5} more…</div>}
                {squad.length === 0 && <div className="text-xs text-slateText">No players purchased yet.</div>}
              </div>
            </LightCard>
          );
        })}
      </div>

      {previewTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewTeam(null)}>
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-black/10 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-black/10 bg-white z-10">
              <h3 className="text-lg font-bold font-display text-navyText">{previewTeam.name}</h3>
              <button onClick={() => setPreviewTeam(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F2F4] text-slateText">×</button>
            </div>
            <div className="p-5">
              <div className="text-xs mb-4 text-slateText">Owner: {previewTeam.owner_name || "—"}</div>
              <div className="space-y-2 mb-5">
                {squadFor(previewTeam.id).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0 border-black/5">
                    <div><span className="text-sm font-semibold text-navyText">{i + 1}. {p.full_name}</span><span className="text-[11px] ml-2 text-slateText">{p.playing_role} · {p.category}</span></div>
                    <span className="text-xs font-mono text-orange">{p.sold_points} pts</span>
                  </div>
                ))}
                {squadFor(previewTeam.id).length === 0 && <div className="text-sm text-slateText">No players purchased yet.</div>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LightButton variant="ghost" size="sm" onClick={() => printSquad(previewTeam)}>PDF / Print Squad</LightButton>
                <LightButton variant="orange" size="sm" onClick={() => downloadSquadImage(previewTeam)}>Download Squad Card (PNG)</LightButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
