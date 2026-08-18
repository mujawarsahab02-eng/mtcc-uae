import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";
import Countdown from "@/components/Countdown";
import PublicNav from "@/components/PublicNav";

export const revalidate = 60;

export default async function LandingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("*").eq("id", 1).single();
  const { data: sponsors } = await supabase.from("sponsors").select("*").order("sort_order");
  const { count: playerCount } = await supabase.from("players").select("*", { count: "exact", head: true });

  function publicUrl(bucket: string, path: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const countdownTarget = settings?.auction_date_time || (settings?.tournament_date ? `${settings.tournament_date}T00:00:00` : null);
  const countdownLabel = settings?.auction_date_time ? "Auction Begins In" : "Tournament Begins In";
  const maxReg = settings?.max_registrations ?? 130;
  const missionPoints = (settings?.mission_points || "").split("\n").filter((l: string) => l.trim());

  const stats = [
    { icon: "💰", label: "Registration Fee", value: `${settings?.currency ?? "AED"} ${settings?.player_reg_fee ?? 25}` },
    { icon: "👥", label: "Squad Size", value: `${settings?.max_squad_size ?? 14}` },
    { icon: "🌏", label: "Guest Quota", value: `${settings?.guest_quota ?? 3}` },
    { icon: "🏆", label: "Teams", value: `${settings?.number_of_teams ?? 8}` },
  ];

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: "#05070d" }}>
      <PublicNav />

      {/* ---------- Stadium night-match hero ---------- */}
      <div className="relative overflow-hidden">
        {/* Deep near-black base with a faint warm glow rising from the pitch */}
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "radial-gradient(ellipse 900px 500px at 50% 100%, #16213D 0%, #0A0F1C 45%, #05070d 75%)" }}
        />

        {/* Floodlight beams — isolated in a fixed-height wrapper anchored to the
            top of the hero, so the beam geometry always converges on the title
            regardless of how tall the rest of the hero content (buttons, links,
            countdown) makes the full section. Without this, the beams were
            calculated against the FULL hero height and crossed far below the
            title instead of on it — that was the second bug. */}
        <div className="absolute top-0 left-0 right-0 h-[760px] -z-10 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 30%, transparent 35%, rgba(0,0,0,0.4) 100%)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "conic-gradient(from 108deg at 0% 0%, transparent 0deg, rgba(255,244,214,0.45) 10deg, rgba(255,244,214,0.15) 20deg, transparent 32deg)",
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "conic-gradient(from 212deg at 100% 0%, transparent 0deg, rgba(255,244,214,0.45) 10deg, rgba(255,244,214,0.15) 20deg, transparent 32deg)",
              mixBlendMode: "screen",
            }}
          />
          <div className="absolute top-8 left-8 w-3 h-3 rounded-full hidden sm:block" style={{ background: "#FFF4D6", boxShadow: "0 0 40px 18px rgba(255,244,214,0.45), 0 0 90px 40px rgba(255,244,214,0.18)" }} />
          <div className="absolute top-8 right-8 w-3 h-3 rounded-full hidden sm:block" style={{ background: "#FFF4D6", boxShadow: "0 0 40px 18px rgba(255,244,214,0.45), 0 0 90px 40px rgba(255,244,214,0.18)" }} />
        </div>

        {/* Fine grain texture for a cinematic finish */}
        <div className="absolute inset-0 -z-10 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />

        {/* Decorative cricket-ball seam watermark — gentle float */}
        <svg className="absolute top-16 right-[-70px] w-[400px] h-[400px] opacity-[0.05] -z-10 hidden lg:block float-slow" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="92" stroke="#D4AF37" strokeWidth="1.5" />
          <path d="M30 40 Q100 90 30 160" stroke="#D4AF37" strokeWidth="2" fill="none" />
          <path d="M170 40 Q100 90 170 160" stroke="#D4AF37" strokeWidth="2" fill="none" />
        </svg>
        {/* Decorative stumps watermark — gentle float */}
        <svg className="absolute bottom-10 left-[-40px] w-[200px] h-[240px] opacity-[0.06] -z-10 hidden lg:block float-slow-rev" viewBox="0 0 120 160" fill="none">
          <rect x="20" y="30" width="6" height="110" fill="#FF7A3D" />
          <rect x="57" y="20" width="6" height="120" fill="#FF7A3D" />
          <rect x="94" y="30" width="6" height="110" fill="#FF7A3D" />
        </svg>

        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-12">
          {/* Clean, straight logo medallion — no tilt */}
          <div
            className="fade-up w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center mb-7 overflow-hidden"
            style={{ border: "3px solid rgba(212,175,55,0.75)", boxShadow: "0 0 0 6px rgba(212,175,55,0.08), 0 25px 60px rgba(0,0,0,0.55), 0 0 50px rgba(255,244,214,0.12)" }}
          >
            <Logo className="w-full h-full" />
          </div>

          <div className="fade-up text-xs uppercase tracking-[0.4em] font-bold mb-4 text-orange" style={{ animationDelay: "0.1s" }}>
            {settings?.season ?? "Season 1"} · {settings?.country ?? "UAE"} · Auction-Based
          </div>

          <h1
            className="fade-up font-serif-lux font-bold text-4xl sm:text-6xl md:text-7xl mb-5 max-w-4xl leading-[1.08] tracking-tight"
            style={{ animationDelay: "0.18s", textShadow: "0 0 50px rgba(255,244,214,0.35), 0 0 100px rgba(212,175,55,0.25)" }}
          >
            {settings?.tournament_name ?? "Maharashtra Tennis Cricket Championship UAE"}
          </h1>

          <p className="fade-up text-muted text-base sm:text-lg max-w-lg mb-7" style={{ animationDelay: "0.26s" }}>
            {settings?.format ?? "One-Day, Tennis Cricket, Grass Ground"} — where every player earns their spot in the auction.
          </p>

          {/* Bolder LIVE indicator */}
          <div
            className="fade-up inline-flex items-center gap-3 mb-9 pl-3 pr-5 py-2.5 rounded-full"
            style={{ animationDelay: "0.34s", background: "linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.45)", boxShadow: "0 0 30px rgba(16,185,129,0.18)" }}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green" style={{ boxShadow: "0 0 12px #10B981" }}></span>
            </span>
            <span className="text-sm font-black tracking-widest text-white">LIVE</span>
            <span className="w-px h-4" style={{ background: "rgba(255,255,255,0.2)" }} />
            <span className="text-sm font-semibold text-muted"><span className="text-goldBright font-bold">{playerCount ?? 0}</span> / {maxReg} registered</span>
          </div>

          <div className="fade-up flex flex-col sm:flex-row gap-4 mb-6" style={{ animationDelay: "0.42s" }}>
            <Link href="/register">
              <Button variant="primary" size="lg" className="!px-10 !py-4 !text-lg shadow-[0_8px_30px_rgba(212,175,55,0.4)] hover:shadow-[0_8px_45px_rgba(212,175,55,0.65)] hover:-translate-y-0.5 transition-all">
                Register as a Player →
              </Button>
            </Link>
            <Link href="/auction/display">
              <Button variant="ghost" size="lg" className="!px-10 !py-4 !text-lg border-2 hover:-translate-y-0.5 transition-transform">
                ⚡ Live Auction Display
              </Button>
            </Link>
          </div>

          <div className="fade-up flex gap-6 text-sm flex-wrap justify-center" style={{ animationDelay: "0.5s" }}>
            <Link href="/standings" className="text-goldBright underline underline-offset-4 font-semibold hover:text-white transition-colors">Points Table</Link>
            <Link href="/squads" className="text-goldBright underline underline-offset-4 font-semibold hover:text-white transition-colors">Team Squads</Link>
            <Link href="/rules" className="text-goldBright underline underline-offset-4 font-semibold hover:text-white transition-colors">Tournament Rules</Link>
          </div>
        </div>

        {countdownTarget && (
          <div className="relative z-10 flex justify-center pb-12 fade-up" style={{ animationDelay: "0.56s" }}>
            <Countdown targetDate={countdownTarget} label={countdownLabel} />
          </div>
        )}

        {/* Warli-art-inspired geometric border band, closing out the hero */}
        <svg className="relative z-10 w-full h-[18px] opacity-40" viewBox="0 0 400 18" preserveAspectRatio="none">
          {Array.from({ length: 40 }).map((_, i) => (
            <g key={i}>
              <polygon points={`${i * 10},18 ${i * 10 + 5},4 ${i * 10 + 10},18`} fill="none" stroke="#D4AF37" strokeWidth="0.6" />
              <circle cx={i * 10 + 5} cy="10" r="0.8" fill="#D4AF37" />
            </g>
          ))}
        </svg>
      </div>

      {/* ---------- Stat strip ---------- */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="glass-card rounded-2xl p-5 sm:p-6 text-center fade-up"
              style={{ animationDelay: `${0.6 + i * 0.08}s` }}
            >
              <div className="icon-badge mx-auto mb-3">{s.icon}</div>
              <div className="text-3xl sm:text-4xl font-black font-display text-goldBright">{s.value}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-mutedDim mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {(settings?.about_text || settings?.vision_text || missionPoints.length > 0) && (
        <div className="relative z-10 max-w-2xl mx-auto px-6 pb-16">
          <div className="text-center mb-6">
            <div className="icon-badge mx-auto mb-3" style={{ fontSize: 18 }}>📖</div>
            <div className="text-xs uppercase tracking-[0.4em] text-orange">About MTCC</div>
          </div>
          {settings?.about_text && (
            <p className="text-center text-muted leading-relaxed mb-8 text-[15px]">{settings.about_text}</p>
          )}
          {settings?.vision_text && (
            <div className="glass-card rounded-2xl p-6 text-center mb-6">
              <div className="text-[10px] uppercase tracking-wide text-mutedDim mb-2">Our Vision</div>
              <p className="font-serif-lux italic text-xl text-ink">&ldquo;{settings.vision_text}&rdquo;</p>
            </div>
          )}
          {missionPoints.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <div className="text-[10px] uppercase tracking-wide text-mutedDim mb-3">Our Mission</div>
              <ul className="space-y-2">
                {missionPoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-goldBright mt-0.5">✦</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------- Journey section ---------- */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-16">
        <div className="text-center mb-9">
          <div className="text-xs uppercase tracking-[0.4em] text-orange mb-2">Your Season Journey</div>
          <h2 className="font-serif-lux font-bold italic text-3xl">Choose Your Place In The Story</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="glass-card rounded-2xl p-6">
            <div className="icon-badge mb-3">🏏</div>
            <div className="text-xs uppercase tracking-wide text-orange font-semibold mb-1">For Players</div>
            <h3 className="font-bold font-display text-lg mb-4">Get registered. Get noticed. Get auctioned.</h3>
            <ol className="space-y-2.5 text-sm text-muted">
              <li><b className="text-goldBright">01</b> Register with your profile and CricHeroes link</li>
              <li><b className="text-goldBright">02</b> Pay the registration fee (bank transfer)</li>
              <li><b className="text-goldBright">03</b> Get reviewed and approved by the committee</li>
              <li><b className="text-goldBright">04</b> Enter the live auction pool</li>
              <li><b className="text-goldBright">05</b> Join the team that wins your bid</li>
            </ol>
            <Link href="/register" className="inline-block mt-5 text-sm font-semibold text-goldBright underline underline-offset-4 hover:text-white transition-colors">Register as a Player →</Link>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="icon-badge mb-3">🏆</div>
            <div className="text-xs uppercase tracking-wide text-orange font-semibold mb-1">For Team Owners</div>
            <h3 className="font-bold font-display text-lg mb-4">Build your squad. Manage your purse. Chase the title.</h3>
            <ol className="space-y-2.5 text-sm text-muted">
              <li><b className="text-goldBright">01</b> Get your team set up by the organising committee</li>
              <li><b className="text-goldBright">02</b> Pay the team entry fee</li>
              <li><b className="text-goldBright">03</b> Receive your auction purse</li>
              <li><b className="text-goldBright">04</b> Bid for players in the live auction</li>
              <li><b className="text-goldBright">05</b> Track your squad and remaining purse live</li>
            </ol>
            <span className="inline-block mt-5 text-xs text-mutedDim">Contact the organising committee to register a team</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pb-6">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <svg className="absolute -bottom-8 -right-8 w-32 h-32 opacity-[0.06]" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" stroke="#FF7A3D" strokeWidth="2" />
            <path d="M18 25 Q50 50 18 75" stroke="#FF7A3D" strokeWidth="2" fill="none" />
          </svg>
          <div className="text-xs uppercase font-bold tracking-wider text-orange mb-4 relative z-10">Tournament Details</div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 relative z-10">
            <Row label="Venue" value={settings?.venue || "To be announced"} />
            <Row label="Ground" value={settings?.ground_name || "To be announced"} />
            <Row label="Tournament Date" value={settings?.tournament_date || "To be announced"} />
            <Row label="Format" value={settings?.format_type || "League + Knockout"} />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center pb-12">
        <Link href="/admin/login" className="text-xs text-mutedDim underline hover:text-muted transition-colors">
          Organiser / Team Owner Sign In →
        </Link>
      </div>

      {sponsors && sponsors.filter((s) => !s.is_powered_by).length > 0 && (
        <div className="relative z-10 max-w-4xl mx-auto px-6 pb-14">
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-mutedDim mb-6">Our Sponsors</div>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {sponsors.filter((s) => !s.is_powered_by).map((s) => {
              const logo = publicUrl("sponsor-logos", s.logo_path);
              const content = (
                <div className="flex flex-col items-center gap-2 opacity-90 hover:opacity-100 hover:-translate-y-1 transition-all">
                  <div className="w-16 h-16 rounded-xl bg-bgCard border border-line flex items-center justify-center overflow-hidden">
                    {logo ? <img src={logo} alt={s.name} className="w-full h-full object-contain p-2" /> : <span className="text-[10px] text-mutedDim px-1 text-center">{s.name}</span>}
                  </div>
                  <span className="text-[11px] text-mutedDim">{s.name}</span>
                </div>
              );
              return s.website_url ? (
                <a key={s.id} href={s.website_url} target="_blank" rel="noreferrer">{content}</a>
              ) : (
                <div key={s.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}

      {sponsors && sponsors.filter((s) => s.is_powered_by).length > 0 && (
        <div className="relative z-10 flex flex-col items-center gap-3 pb-10 border-t border-line pt-8 max-w-md mx-auto">
          <span className="text-[10px] uppercase tracking-[0.25em] text-mutedDim">Powered By</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {sponsors.filter((s) => s.is_powered_by).map((s) => {
              const logo = publicUrl("sponsor-logos", s.logo_path);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  {logo && (
                    <div className="w-6 h-6 rounded-md overflow-hidden bg-bgCard border border-line flex items-center justify-center shrink-0">
                      <img src={logo} alt={s.name} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-muted">{s.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line py-2">
      <span className="text-mutedDim text-sm">{label}</span>
      <span className="text-ink font-semibold text-sm">{value}</span>
    </div>
  );
}
