import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import { IconWallet, IconUsers, IconTrophy, IconCalendar, IconGavel, IconShieldCheck, IconClipboardCheck, IconHandshake, IconList, IconRefresh, IconCricketBall, IconStar, IconGlobe } from "@/components/Icons";

export const revalidate = 60;

export default async function LandingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();
  const { data: sponsors } = await supabase.from("sponsors").select("*").order("sort_order");
  const { count: playerCount } = await supabase.from("players").select("*", { count: "exact", head: true });
  const { data: teams } = await supabase.from("team_public").select("*");

  function publicUrl(bucket: string, path: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const maxReg = settings?.max_registrations ?? 130;
  const currentReg = playerCount ?? 0;
  const regClosed = currentReg >= maxReg;
  const regPct = Math.min(100, Math.round((currentReg / maxReg) * 100));
  const missionPoints = (settings?.mission_points || "").split("\n").filter((l: string) => l.trim());
  const generalSponsors = (sponsors ?? []).filter((s) => !s.is_powered_by);
  const poweredBy = (sponsors ?? []).filter((s) => s.is_powered_by);

  const snapshotStats = [
    { icon: IconWallet, label: "Player Registration", value: `${settings?.currency ?? "AED"} ${settings?.player_reg_fee ?? 25}` },
    { icon: IconUsers, label: "Players Per Squad", value: `${settings?.max_squad_size ?? 14}` },
    { icon: IconTrophy, label: "Teams", value: `${settings?.number_of_teams ?? 8}` },
    { icon: IconCalendar, label: "Championship", value: "One Day" },
    { icon: IconGavel, label: "Team Selection", value: "Auction" },
  ];
  if (settings?.guest_quota) {
    snapshotStats.push({ icon: IconGlobe, label: "Guest Player Quota", value: `${settings.guest_quota}` });
  }

  const journeySteps = [
    { n: "01", label: "Register", icon: IconClipboardCheck },
    { n: "02", label: "Verification", icon: IconShieldCheck },
    { n: "03", label: "Auction Pool", icon: IconUsers },
    { n: "04", label: "Live Auction", icon: IconGavel },
    { n: "05", label: "Team Selection", icon: IconHandshake },
    { n: "06", label: "Match Day", icon: IconCricketBall },
    { n: "07", label: "Champion", icon: IconTrophy },
  ];

  const missionIcons = [IconStar, IconGlobe, IconShieldCheck, IconHandshake, IconUsers, IconRefresh, IconTrophy];

  const rulesCards = [
    { title: "Player Eligibility", desc: "Who can register and represent Maharashtra.", icon: IconShieldCheck },
    { title: "Auction Rules", desc: "How the live player auction works.", icon: IconGavel },
    { title: "Match Conditions", desc: "Overs, format and on-field playing conditions.", icon: IconCricketBall },
    { title: "Code of Conduct", desc: "Sportsmanship and disciplinary standards.", icon: IconHandshake },
    { title: "Points & Qualification", desc: "How the standings and qualification work.", icon: IconList },
    { title: "Super Over Rules", desc: "How tied matches are decided.", icon: IconRefresh },
  ];

  const prizes = [
    { title: "Champions", value: "AED 6,000 + Trophy" },
    { title: "Runner-Up", value: "AED 4,000 + Trophy" },
    { title: "Player of the Tournament", value: "AED 500 + Trophy" },
    { title: "Best Batsman", value: "AED 250 + Trophy" },
    { title: "Best Bowler", value: "AED 250 + Trophy" },
    { title: "Best Fielder", value: "AED 250 + Trophy" },
    { title: "Man of the Match", value: "AED 100 + Trophy per match" },
  ];

  return (
    <main className="bg-warmWhite">
      <PublicNav />

      {/* ================= SECTION 1 — CINEMATIC HERO (dark, deliberate) ================= */}
      <div className="relative overflow-hidden" style={{ background: "#05070d" }}>
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse 900px 500px at 50% 100%, #16213D 0%, #0A0F1C 45%, #05070d 75%)" }} />
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at 50% 25%, transparent 30%, rgba(0,0,0,0.5) 100%)" }} />
        <div className="absolute inset-0 -z-10 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />
        <svg className="absolute top-16 right-[-70px] w-[400px] h-[400px] opacity-[0.05] -z-10 hidden lg:block float-slow" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" stroke="#D4AF37" strokeWidth="1.5" />
          <path d="M30 40 Q100 90 30 160" stroke="#D4AF37" strokeWidth="2" fill="none" />
        </svg>

        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-14">
          <div className="fade-up w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6 overflow-hidden" style={{ border: "3px solid rgba(212,175,55,0.75)", boxShadow: "0 0 0 6px rgba(212,175,55,0.08), 0 20px 50px rgba(0,0,0,0.5), 0 0 50px rgba(255,244,214,0.1)" }}>
            <Logo className="w-full h-full" />
          </div>
          <div className="fade-up text-xs uppercase tracking-[0.4em] font-bold mb-4 text-orange" style={{ animationDelay: "0.1s" }}>
            {settings?.season ?? "Season 1"} · U.A.E. · Auction-Based
          </div>
          <h1 className="fade-up font-display font-black text-4xl sm:text-6xl mb-3 max-w-4xl leading-[1.08] tracking-tight text-white" style={{ animationDelay: "0.18s" }}>
            {(settings?.tournament_name ?? "Maharashtra Tennis Cricket Championship UAE").replace(/ UAE$/i, "")}<br />
            <span className="text-goldBright">U.A.E.</span>
          </h1>
          <div className="fade-up text-sm sm:text-base text-orange font-semibold tracking-wide mb-3" style={{ animationDelay: "0.24s" }}>
            One Maharashtra. One Passion. One Championship.
          </div>
          <p className="fade-up text-white/60 text-base max-w-lg mb-8" style={{ animationDelay: "0.3s" }}>
            {settings?.format ?? "One-Day Tennis Cricket Championship on Grass"}
          </p>

          <div className="fade-up flex flex-col sm:flex-row gap-4 mb-10" style={{ animationDelay: "0.38s" }}>
            <Link href="/register">
              <Button variant="primary" size="lg" className="!px-10 !py-4 !text-lg shadow-[0_8px_30px_rgba(212,175,55,0.4)] hover:-translate-y-0.5 transition-all">
                Register Now →
              </Button>
            </Link>
            <a href="#details">
              <Button variant="ghost" size="lg" className="!px-10 !py-4 !text-lg border-2 border-white/25 text-white hover:-translate-y-0.5 transition-transform">
                Tournament Information
              </Button>
            </a>
          </div>

          {/* Live registration indicator with progress bar, per spec */}
          <div className="fade-up w-full max-w-sm rounded-2xl p-5" style={{ animationDelay: "0.46s", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {regClosed ? (
              <div className="text-center text-orange font-bold text-sm uppercase tracking-wide">Registration Closed</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">Player Registration Open</span>
                  <span className="text-sm font-bold text-goldBright">{currentReg} / {maxReg}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
                  <div className="h-full rounded-full" style={{ width: `${regPct}%`, background: "linear-gradient(90deg, #D4AF37, #F37032)" }} />
                </div>
              </>
            )}
          </div>

          <div className="fade-up mt-6 text-xs" style={{ animationDelay: "0.5s" }}>
            <Link href="/auction/display" className="text-white/40 underline hover:text-white/70 transition-colors">View Live Auction Display</Link>
          </div>
        </div>
      </div>

      {/* ================= SECTION 2 — TOURNAMENT SNAPSHOT (light) ================= */}
      <div id="details" className="max-w-6xl mx-auto px-6 py-16">
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${snapshotStats.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-4`}>
          {snapshotStats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 text-center">
              <s.icon className="w-7 h-7 mx-auto mb-3 text-orange" />
              <div className="text-xl sm:text-2xl font-black font-display text-navyText">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wide font-bold text-slateText mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= SECTION 3 — ABOUT MTCC (two-column, light) ================= */}
      {settings?.about_text && (
        <div className="bg-cream py-16">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
            <div className="relative rounded-3xl overflow-hidden h-72 md:h-96" style={{ background: "linear-gradient(160deg, #0B1F3A, #16213D)" }}>
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 300" fill="none">
                <circle cx="150" cy="150" r="120" stroke="#D4AF37" strokeWidth="2" />
                <path d="M60 90 Q150 170 60 250" stroke="#D4AF37" strokeWidth="3" fill="none" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-gold/70 bg-white">
                  <Logo className="w-full h-full" />
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-3">About MTCC</div>
              <h2 className="font-display font-black text-3xl text-navyText mb-2">More Than A Tournament</h2>
              <p className="text-slateText font-semibold mb-4">A platform for Maharashtra&apos;s cricket community in the U.A.E.</p>
              <p className="text-slateText leading-relaxed line-clamp-6">{settings.about_text}</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 4 — VISION & MISSION (cream) ================= */}
      {(settings?.vision_text || missionPoints.length > 0) && (
        <div className="bg-warmWhite py-16">
          <div className="max-w-5xl mx-auto px-6">
            {settings?.vision_text && (
              <div className="text-center mb-12">
                <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-3">Our Vision</div>
                <p className="font-serif-lux italic text-2xl sm:text-3xl text-navyText max-w-3xl mx-auto leading-snug">&ldquo;{settings.vision_text}&rdquo;</p>
              </div>
            )}
            {missionPoints.length > 0 && (
              <>
                <div className="text-center mb-8">
                  <h3 className="font-display font-black text-2xl text-navyText">What We Stand For</h3>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {missionPoints.map((point: string, i: number) => {
                    const Icon = missionIcons[i % missionIcons.length];
                    const [title, ...rest] = point.split("—").map((s) => s.trim());
                    return (
                      <div key={i} className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
                        <Icon className="w-6 h-6 text-orange mb-3" />
                        <div className="font-bold text-navyText text-sm mb-1">{title}</div>
                        {rest.length > 0 && <div className="text-slateText text-xs leading-relaxed">{rest.join("—")}</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 5 — TOURNAMENT JOURNEY ================= */}
      <div className="bg-cream py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Your Season Journey</div>
            <h2 className="font-display font-black text-3xl text-navyText">The Road To Match Day</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-2">
            {journeySteps.map((step, i) => (
              <div key={step.n} className="flex md:flex-col items-center md:text-center gap-4 md:gap-0 flex-1 fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 md:mb-3" style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-orange">{step.n}</div>
                  <div className="text-sm font-bold text-navyText">{step.label}</div>
                </div>
                {i < journeySteps.length - 1 && <div className="hidden md:block h-px bg-gold/30 flex-1 mt-7" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= SECTION 6 — AUCTION EXPERIENCE (second dark section) ================= */}
      <div className="relative overflow-hidden py-20" style={{ background: "#05070d" }}>
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at 50% 50%, #16213D 0%, #05070d 75%)" }} />
        <svg className="absolute top-8 right-[-60px] w-[350px] h-[350px] opacity-[0.06] -z-10 hidden lg:block" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" stroke="#D4AF37" strokeWidth="1.5" />
        </svg>
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <IconGavel className="w-10 h-10 text-goldBright mx-auto mb-5" />
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white mb-4 leading-tight">Your Name. Your Game.<br />The Auction Awaits.</h2>
          <p className="text-white/60 mb-8">Build the squad. Manage the purse. Chase the championship.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auction/display">
              <Button variant="primary" size="lg" className="!px-8 hover:-translate-y-0.5 transition-transform">View Auction</Button>
            </Link>
            <Link href="/squads">
              <Button variant="ghost" size="lg" className="!px-8 border-2 border-white/25 text-white hover:-translate-y-0.5 transition-transform">View Squads</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ================= SECTION 7 — TEAMS ================= */}
      <div className="bg-warmWhite py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">The Competitors</div>
            <h2 className="font-display font-black text-3xl text-navyText">Teams</h2>
          </div>
          {teams && teams.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {teams.map((t) => {
                const logo = publicUrl("team-logos", t.logo_path);
                return (
                  <Link key={t.id} href="/squads" className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 text-center hover:-translate-y-1 transition-transform">
                    <div className="w-14 h-14 rounded-xl mx-auto mb-3 bg-cream flex items-center justify-center overflow-hidden">
                      {logo ? <img src={logo} alt={t.name} className="w-full h-full object-contain p-1.5" /> : <span className="text-xs font-bold text-orange">{t.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="font-bold text-navyText text-sm">{t.name}</div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slateText py-8">Teams To Be Announced</div>
          )}
        </div>
      </div>

      {/* ================= SECTION 8 — PRIZES & AWARDS ================= */}
      <div className="bg-cream py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Prizes & Awards</div>
            <h2 className="font-display font-black text-3xl text-navyText">Play For Glory</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {prizes.map((p) => (
              <div key={p.title} className="bg-white rounded-2xl border border-gold/25 shadow-sm p-5 flex items-center gap-4">
                <IconTrophy className="w-8 h-8 text-orange shrink-0" />
                <div>
                  <div className="font-bold text-navyText text-sm">{p.title}</div>
                  <div className="text-goldBright font-black text-sm">{p.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= SECTION 9 — RULES PREVIEW ================= */}
      <div className="bg-warmWhite py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Know The Game</div>
            <h2 className="font-display font-black text-3xl text-navyText">Tournament Rules</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rulesCards.map((r) => (
              <Link key={r.title} href="/rules" className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 hover:-translate-y-1 transition-transform">
                <r.icon className="w-7 h-7 text-orange mb-3" />
                <div className="font-bold text-navyText text-sm mb-1">{r.title}</div>
                <div className="text-slateText text-xs mb-3">{r.desc}</div>
                <span className="text-orange text-xs font-bold">Read Rules →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ================= SECTION 10 — TOURNAMENT DETAILS ================= */}
      <div className="bg-cream py-16">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white rounded-3xl border border-black/5 shadow-sm p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-5">Tournament Details</div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Venue" value={settings?.venue} />
              <DetailRow label="Ground" value={settings?.ground_name} />
              <DetailRow label="Tournament Date" value={settings?.tournament_date} />
              <DetailRow label="Reporting Time" value={settings?.reporting_time} />
              <DetailRow label="Start Time" value={settings?.start_time} />
              <DetailRow label="Format" value={settings?.format_type} />
              <DetailRow label="Number of Overs" value={settings?.number_of_overs ? `${settings.number_of_overs} overs` : null} />
              <DetailRow label="Teams" value={settings?.number_of_teams ? `${settings.number_of_teams}` : null} />
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 11 — SPONSORS ================= */}
      {generalSponsors.length > 0 && (
        <div id="sponsors" className="bg-warmWhite py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-8">Our Partners</div>
            <div className="flex flex-wrap items-center justify-center gap-10">
              {generalSponsors.map((s) => {
                const logo = publicUrl("sponsor-logos", s.logo_path);
                const content = (
                  <div className="flex flex-col items-center gap-3 hover:-translate-y-1 transition-transform">
                    <div className="w-24 h-24 rounded-2xl bg-white border border-black/5 shadow-sm flex items-center justify-center overflow-hidden p-3">
                      {logo ? <img src={logo} alt={s.name} className="w-full h-full object-contain" /> : <span className="text-xs font-bold text-orange text-center">{s.name}</span>}
                    </div>
                    <span className="text-sm font-semibold text-navyText">{s.name}</span>
                  </div>
                );
                return s.website_url ? <a key={s.id} href={s.website_url} target="_blank" rel="noreferrer">{content}</a> : <div key={s.id}>{content}</div>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 12 — POWERED BY ================= */}
      {poweredBy.length > 0 && (
        <div className="bg-cream py-14">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-8">Powered By</div>
            <div className="flex flex-wrap items-center justify-center gap-10">
              {poweredBy.map((s) => {
                const logo = publicUrl("sponsor-logos", s.logo_path);
                return (
                  <div key={s.id} className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-black/5 shadow-sm flex items-center justify-center overflow-hidden p-3">
                      {logo ? <img src={logo} alt={s.name} className="w-full h-full object-contain" /> : <span className="text-xs font-bold text-orange text-center">{s.name}</span>}
                    </div>
                    <span className="text-sm font-semibold text-navyText">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-warmWhite pb-8 text-center">
        <Link href="/admin/login" className="text-xs text-slateText underline hover:text-navyText transition-colors">
          Organiser / Team Owner Sign In →
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-black/5 py-2">
      <span className="text-slateText text-sm">{label}</span>
      <span className="text-navyText font-semibold text-sm">{value || "To Be Announced"}</span>
    </div>
  );
}
