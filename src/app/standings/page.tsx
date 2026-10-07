import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";

export const revalidate = 30;

const GOLD = "linear-gradient(180deg,#FFE27A 0%,#F5B72E 100%)";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function fmtDate(d: string | null) {
  if (!d) return "DATE TBA";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
function fmtTime(t: string | null) {
  if (!t) return "TBA";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
}
function ordinal(n: number) {
  const s = ["TH", "ST", "ND", "RD"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function SchedulePage() {
  const supabase = createClient();
  const [{ data: matches }, { data: teams }, { data: labels }] = await Promise.all([
    supabase.from("match_public").select("*"),
    supabase.from("team_public").select("*"),
    supabase.from("match_labels_public").select("*"),
  ]);

  const teamName = (id: string | null) => teams?.find((t: any) => t.id === id)?.name || "TBA";
  const sideName = (m: any, side: "a" | "b") => {
    const id = side === "a" ? m.team_a_id : m.team_b_id;
    if (id) return teamName(id);
    const l = (labels ?? []).find((x: any) => x.id === m.id);
    return (side === "a" ? l?.team_a_label : l?.team_b_label) || "TBA";
  };

  const list = [...(matches ?? [])].sort((a: any, b: any) =>
    (a.match_date || "9999").localeCompare(b.match_date || "9999") ||
    (a.match_time || "99").localeCompare(b.match_time || "99") ||
    (a.match_number ?? 999) - (b.match_number ?? 999)
  );

  // Group the rows by day.
  const days: { date: string | null; rows: any[] }[] = [];
  for (const m of list) {
    const last = days[days.length - 1];
    if (last && last.date === (m.match_date || null)) last.rows.push(m);
    else days.push({ date: m.match_date || null, rows: [m] });
  }
  const grounds = Array.from(new Set(list.map((m: any) => m.ground).filter(Boolean))) as string[];
  const singleGround = grounds.length === 1 ? grounds[0] : null;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top,#1B2A5E 0%,#0A0F24 60%,#05070F 100%)" }}>
      <PublicNav />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 pt-8 pb-12 text-white">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="MTCC U.A.E." className="h-28 sm:h-36 mx-auto mb-4 object-contain" />
          <h1 className="font-display font-black text-2xl sm:text-4xl leading-tight uppercase" style={{ color: "#F5C542", textShadow: "0 2px 12px rgba(245,183,46,.4)" }}>
            Maharashtra Tennis Cricket<br />Championship U.A.E.
          </h1>
          <div className="mt-2 text-xs tracking-[0.3em] uppercase text-white/60">Season 1 · Match Schedule</div>
        </div>

        {list.length === 0 && <div className="text-center text-white/70 py-12">The schedule will be announced soon.</div>}

        {days.map((day, di) => (
          <div key={di} className="mb-8">
            <div className="text-center mb-4">
              <span className="inline-block px-8 py-2 rounded-lg font-display font-black text-xl sm:text-2xl text-[#111]" style={{ background: GOLD }}>
                {fmtDate(day.date)}
              </span>
            </div>
            <div className="space-y-2">
              {day.rows.map((m: any) => {
                const knock = m.stage === "Semi-Final" || m.stage === "Final" || (m.stage && m.stage !== "League");
                const isFinal = m.stage === "Final";
                const left = isFinal ? "FINAL" : knock ? `${m.stage}${m.group_name ? ` (${m.group_name})` : ""}`.toUpperCase() : null;
                const pillClr = m.status === "Live" ? "#F5C542" : m.status === "Completed" ? "#3DDC97" : "#9AA3B8";
                const clickable = m.status === "Live" || m.status === "Completed";
                const body = (
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ background: "#0A0F24" }}>
                    <div className="flex items-stretch min-h-[54px]">
                      <div className="w-[88px] sm:w-[110px] shrink-0 flex items-center justify-center text-center font-display font-black text-[13px] sm:text-base text-white" style={{ background: knock ? "#8E0F1B" : "#C8102E" }}>
                        {fmtTime(m.match_time)}
                      </div>
                      <div className="w-[70px] sm:w-[96px] shrink-0 flex flex-col items-center justify-center text-center px-1 text-[10px] sm:text-xs font-black leading-tight" style={{ background: knock ? "#6E0B15" : "#14245E", color: knock ? "#fff" : "#F5C542" }}>
                        {left ? (
                          <span className={isFinal ? "text-base sm:text-xl" : ""}>{left}</span>
                        ) : (
                          <>
                            <span className="text-white/90">{m.match_number ? `${ordinal(m.match_number)} MATCH` : "MATCH"}</span>
                            <span className="uppercase">{m.group_name || ""}</span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-stretch text-[#111]" style={{ background: GOLD }}>
                        <div className="flex items-center justify-center text-center px-2 py-2 font-black uppercase text-[11px] sm:text-sm leading-tight">{sideName(m, "a")}</div>
                        <div className="flex items-center justify-center px-2 sm:px-4 font-black text-xs sm:text-sm text-[#F5C542]" style={{ background: "#0A0F24" }}>VS</div>
                        <div className="flex items-center justify-center text-center px-2 py-2 font-black uppercase text-[11px] sm:text-sm leading-tight">{sideName(m, "b")}</div>
                      </div>
                    </div>
                    {(m.status !== "Scheduled" || (!singleGround && m.ground)) && (
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-white/80 bg-black/40">
                        <span>
                          {m.status === "Completed" ? (
                            <>
                              {m.team_a_score && <>{teamName(m.team_a_id)} {m.team_a_score}{m.team_a_overs ? ` (${m.team_a_overs})` : ""} · </>}
                              {m.team_b_score && <>{teamName(m.team_b_id)} {m.team_b_score}{m.team_b_overs ? ` (${m.team_b_overs})` : ""} · </>}
                              <b className="text-[#F5C542]">{m.is_tie ? "Match tied" : m.winner_id ? `${teamName(m.winner_id)} won${m.margin ? " by " + m.margin : ""}` : ""}</b>
                            </>
                          ) : !singleGround ? m.ground : ""}
                        </span>
                        {m.status !== "Scheduled" && (
                          <span className="font-bold uppercase tracking-wide" style={{ color: pillClr }}>{m.status === "Live" ? "● Live" : m.status}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
                return clickable ? (
                  <Link key={m.id} href={`/matches/${m.id}`} className="block hover:-translate-y-0.5 transition-transform">{body}</Link>
                ) : (
                  <div key={m.id}>{body}</div>
                );
              })}
            </div>
          </div>
        ))}

        {singleGround && (
          <div className="text-center mt-6">
            <div className="inline-block px-5 py-1 rounded-t-lg text-xs font-black text-[#111]" style={{ background: GOLD }}>VENUE :</div>
            <div className="rounded-xl border-2 border-[#F5C542] px-6 py-3 font-display font-black text-lg sm:text-2xl uppercase" style={{ background: "#0A0F24", color: "#fff" }}>
              📍 {singleGround}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
