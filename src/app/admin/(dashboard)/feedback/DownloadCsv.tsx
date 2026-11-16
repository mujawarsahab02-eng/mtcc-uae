"use client";

const COLS: [string, string][] = [
  ["created_at", "Submitted"], ["respondent_type", "Who"], ["team_name", "Team"], ["overall", "Overall"],
  ["rating_organisation", "Organisation"], ["rating_ground", "Ground"], ["rating_food", "Food"],
  ["rating_umpiring", "Umpiring"], ["rating_live_scores", "Live scores"], ["format_opinion", "5-over format"],
  ["auction_rating", "Auction day"], ["best_part", "Best part"], ["improve", "Improve"],
  ["season2", "Season 2"], ["name", "Name"], ["phone", "Phone"],
];

export default function DownloadCsv({ rows }: { rows: any[] }) {
  function download() {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [COLS.map(([, h]) => esc(h)).join(",")];
    rows.forEach((r) => lines.push(COLS.map(([k]) => esc(r[k])).join(",")));
    // BOM so Excel opens it with the right characters
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mtcc-season1-feedback.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <button onClick={download} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#0B1B3A" }}>
      Download Excel (CSV)
    </button>
  );
}
