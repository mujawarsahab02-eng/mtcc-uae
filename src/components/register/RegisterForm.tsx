"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import Logo from "@/components/Logo";
import { IconShieldCheck, IconClipboardCheck, IconCricketBall, IconWallet } from "@/components/Icons";
import { PLAYING_ROLES, BATTING_STYLES, PLAYER_TYPES, EMIRATES } from "@/lib/constants";

type Settings = {
  currency: string;
  player_reg_fee: number;
  cricheroes_required: boolean;
  emirates_id_required: boolean;
  terms_and_conditions: string;
  shirt_note?: string;
  bank_account_name?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  powered_by_name?: string;
  powered_by_logo_path?: string;
  ziina_qr_path?: string;
} | null;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const STEPS = [
  { key: "personal", label: "Personal", icon: IconClipboardCheck },
  { key: "identification", label: "Identification", icon: IconShieldCheck },
  { key: "cricket", label: "Cricket", icon: IconCricketBall },
  { key: "payment", label: "Payment", icon: IconWallet },
  { key: "declaration", label: "Submit", icon: IconClipboardCheck },
];

function emptyForm() {
  return {
    fullName: "", dob: "", mobile: "", whatsapp: "", email: "",
    emirate: "", uaeLocation: "", playerType: PLAYER_TYPES[0] as string, district: "", state: "",
    emiratesId: "", emiratesIdExpiry: "",
    cricheroes: "", role: PLAYING_ROLES[0] as string, battingStyle: BATTING_STYLES[0] as string, bowlingStyle: "",
    battingPosition: "", currentTeam: "", notes: "",
    paymentMethod: "", paymentRef: "",
    declarationAccepted: false,
  };
}

// Section wrapper: white card, navy heading, gold step badge — replaces the
// old dark "LuxSection" editorial look with the light form-card style.
function Section({ n, title, sectionRef, children }: { n: string; title: string; sectionRef?: React.RefObject<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div ref={sectionRef} className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 mb-5 scroll-mt-32">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #D4AF37, #F37032)" }}>
          {n}
        </div>
        <h2 className="font-display font-bold text-lg text-navyText">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-5">
      <span className="block text-[11px] font-bold uppercase tracking-[0.1em] mb-2 text-slateText">
        {label} {required && <span className="text-orange">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] mt-1.5 text-slateText italic">{hint}</span>}
    </label>
  );
}

function SummaryPoint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold mt-0.5" style={{ background: "#D4AF37" }}>✓</span>
      <span className="text-sm text-slateText leading-relaxed">{children}</span>
    </div>
  );
}

function PoweredByCorner({ sponsors }: { sponsors: any[] }) {
  const supabase = createClient();
  function publicUrl(bucket: string, path?: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const poweredBy = (sponsors || []).filter((s) => s.is_powered_by);
  if (poweredBy.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">Powered By</span>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {poweredBy.map((s) => {
          const logo = publicUrl("sponsor-logos", s.logo_path);
          return (
            <div key={s.id} className="flex items-center gap-1.5 bg-white/10 backdrop-blur border border-white/15 rounded-full pl-1 pr-2.5 py-1">
              {logo ? (
                <div className="w-5 h-5 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                  <img src={logo} alt={s.name} className="w-full h-full object-contain" />
                </div>
              ) : null}
              <span className="text-[10px] font-semibold text-white/80 whitespace-nowrap">{s.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SponsorsFooter({ sponsors }: { sponsors: any[] }) {
  const supabase = createClient();
  function publicUrl(bucket: string, path?: string | null) {
    if (!path) return null;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const regular = (sponsors || []).filter((s) => !s.is_powered_by);
  if (regular.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-4">
      <div className="mb-8">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-slateText mb-5">Our Sponsors</div>
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
          {regular.map((s) => {
            const logo = publicUrl("sponsor-logos", s.logo_path);
            const content = (
              <div className="flex flex-col items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 rounded-xl bg-white border border-black/5 shadow-sm flex items-center justify-center overflow-hidden">
                  {logo ? <img src={logo} alt={s.name} className="w-full h-full object-contain p-1.5" /> : <span className="text-[10px] text-slateText px-1 text-center">{s.name}</span>}
                </div>
                <span className="text-[10px] text-slateText">{s.name}</span>
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
    </div>
  );
}

// Sticky step progress bar — tracks which form section is currently in view
// via IntersectionObserver and highlights it. Purely presentational; the
// form itself stays a single scrollable page and still submits only through
// the one existing handleSubmit flow (no multi-step server logic).
function StepProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-md border-b border-black/5">
      <div className="max-w-2xl mx-auto px-5 py-3">
        <div className="hidden sm:flex items-center justify-between">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
                  style={{
                    background: i <= activeIndex ? "linear-gradient(135deg, #D4AF37, #F37032)" : "#E2E5EA",
                    color: i <= activeIndex ? "#fff" : "#9AA3B2",
                  }}
                >
                  {i + 1}
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: i <= activeIndex ? "#152238" : "#9AA3B2" }}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1.5 mt-[-14px]" style={{ background: i < activeIndex ? "#D4AF37" : "#E2E5EA" }} />
              )}
            </div>
          ))}
        </div>
        <div className="sm:hidden text-center text-xs font-bold text-navyText">
          Step {activeIndex + 1} of {STEPS.length} — {STEPS[activeIndex]?.label}
        </div>
      </div>
    </div>
  );
}

export default function RegisterForm({ settings, closed, spotsRemaining, sponsors = [] }: { settings: Settings; closed?: boolean; spotsRemaining?: number; sponsors?: any[] }) {
  const router = useRouter();
  const supabase = createClient();
  const currency = settings?.currency ?? "AED";
  const fee = settings?.player_reg_fee ?? 25;
  const shirtNote = settings?.shirt_note || "A team T-shirt will be provided to every registered player.";

  const [form, setForm] = useState(emptyForm());
  const [files, setFiles] = useState<{ photo?: File; receipt?: File }>({});
  const [fileErr, setFileErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const personalRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<HTMLDivElement>(null);
  const cricketRef = useRef<HTMLDivElement>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const declarationRef = useRef<HTMLDivElement>(null);
  const sectionRefs = [personalRef, idRef, cricketRef, paymentSectionRef, declarationRef];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.findIndex((r) => r.current === entry.target);
            if (idx !== -1) setActiveStep(idx);
          }
        });
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );
    sectionRefs.forEach((r) => r.current && observer.observe(r.current));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleFile(key: "photo" | "receipt") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        setFileErr((s) => ({ ...s, [key]: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).` }));
        e.target.value = "";
        return;
      }
      setFileErr((s) => ({ ...s, [key]: "" }));
      setFiles((f) => ({ ...f, [key]: file }));
    };
  }

  async function uploadTo(bucket: string, file: File) {
    const path = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr("");

    if (!form.fullName || !form.mobile || !form.emiratesId || (settings?.cricheroes_required && !form.cricheroes)) {
      setFormErr("Please complete all required fields.");
      return;
    }
    if (form.playerType === "Maharashtra Player" && !form.district) {
      setFormErr("Please enter your Maharashtra District / Home Town.");
      return;
    }
    if (form.playerType === "Guest Indian Player" && !form.state) {
      setFormErr("Please enter your State in India.");
      return;
    }
    if (!form.declarationAccepted) {
      setFormErr("You must accept the registration declaration to submit.");
      return;
    }
    if (!form.paymentMethod) {
      setFormErr("Please select a payment method.");
      return;
    }
    if (!files.receipt) {
      setFormErr("Please upload a screenshot of your payment before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const [photoPath, receiptPath] = await Promise.all([
        files.photo ? uploadTo("player-photos", files.photo) : Promise.resolve(null),
        files.receipt ? uploadTo("payment-receipts", files.receipt) : Promise.resolve(null),
      ]);

      const { data: newId, error } = await supabase.rpc("register_player", {
        payload: {
          full_name: form.fullName, photo_path: photoPath, dob: form.dob || null,
          mobile: form.mobile, whatsapp: form.whatsapp, email: form.email,
          emirate: form.emirate, uae_location: form.uaeLocation,
          player_type: form.playerType, district: form.district, state: form.state,
          nationality: "Indian",
          emirates_id: form.emiratesId, emirates_id_expiry: form.emiratesIdExpiry || null, emirates_id_path: null,
          cricheroes_url: form.cricheroes, playing_role: form.role, batting_style: form.battingStyle,
          bowling_style: form.bowlingStyle, batting_position: form.battingPosition,
          current_team: form.currentTeam,
          payment_reference: form.paymentRef, payment_receipt_path: receiptPath,
          declaration_accepted: form.declarationAccepted,
        },
      });

      if (error) throw error;
      router.push(`/registration-success?id=${newId}`);
    } catch (err: any) {
      setFormErr(err.message || "Something went wrong submitting your registration.");
    } finally {
      setSubmitting(false);
    }
  }

  if (closed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-cream">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-black/5 p-8 text-center mb-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl bg-orange/10 text-orange">✕</div>
          <h2 className="text-xl font-bold mb-2 font-display text-navyText">Registration Closed</h2>
          <p className="text-sm leading-relaxed text-slateText">
            Player registration has reached its maximum capacity for this season. Thank you to everyone who registered — approved players will be contacted ahead of the auction.
          </p>
        </div>
        <SponsorsFooter sponsors={sponsors} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-cream light-form">
      {/* Compact dark header banner */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0F1729 0%, #0A0F1C 100%)" }}>
        <PoweredByCorner sponsors={sponsors} />
        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 overflow-hidden" style={{ border: "1px solid rgba(212,175,55,0.6)", boxShadow: "0 0 0 4px rgba(212,175,55,0.08)" }}>
            <Logo className="w-full h-full" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] font-semibold mb-2 text-orange">Player Registration</div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white leading-snug">
            Maharashtra Tennis Cricket Championship U.A.E.
          </h1>
        </div>
      </div>

      <StepProgress activeIndex={activeStep} />

      <div className="max-w-2xl mx-auto px-5 pt-6">
        {/* Registration summary card */}
        <div className="rounded-2xl border border-gold/25 shadow-sm p-6 mb-6 bg-white">
          <div className="text-center mb-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slateText mb-1">Registration Fee</div>
            <div className="font-display font-black text-4xl text-navyText">{currency} {fee}</div>
            {typeof spotsRemaining === "number" && (
              <div className="text-[11px] text-slateText mt-1">{spotsRemaining} registration {spotsRemaining === 1 ? "spot" : "spots"} remaining this season</div>
            )}
          </div>
          <div className="w-full h-px my-3 bg-black/5" />
          <SummaryPoint>Registration does not guarantee auction selection.</SummaryPoint>
          <SummaryPoint>The fee is non-refundable.</SummaryPoint>
          <SummaryPoint>No auction salary/payment is paid to players.</SummaryPoint>
          <SummaryPoint>{shirtNote}</SummaryPoint>
          {settings?.emirates_id_required && <SummaryPoint>Emirates ID is mandatory.</SummaryPoint>}
          {settings?.cricheroes_required && <SummaryPoint>CricHeroes profile is mandatory.</SummaryPoint>}
        </div>

        <form onSubmit={handleSubmit}>
          <Section n="1" title="Personal Details" sectionRef={personalRef}>
            <Field label="Full Name (as per Emirates ID)" required>
              <input value={form.fullName} onChange={set("fullName")} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date of Birth" required>
                <input type="date" value={form.dob} onChange={set("dob")} required />
              </Field>
              <Field label="Nationality" hint="Required to be Indian for this category">
                <input value="Indian" disabled />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Mobile Number" required>
                <input value={form.mobile} onChange={set("mobile")} required inputMode="tel" />
              </Field>
              <Field label="WhatsApp Number">
                <input value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
              </Field>
            </div>
            <Field label="Email Address">
              <input type="email" value={form.email} onChange={set("email")} inputMode="email" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Current Emirate" required>
                <select value={form.emirate} onChange={set("emirate")} required>
                  <option value="">Select</option>
                  {EMIRATES.map((e) => <option key={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Current UAE Location">
                <input value={form.uaeLocation} onChange={set("uaeLocation")} />
              </Field>
            </div>

            <Field label="Player Type" required>
              <select value={form.playerType} onChange={set("playerType")}>
                {PLAYER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {form.playerType === "Maharashtra Player" ? (
              <Field label="Maharashtra District / Home Town" required>
                <input value={form.district} onChange={set("district")} required />
              </Field>
            ) : (
              <Field label="State in India" required>
                <input value={form.state} onChange={set("state")} required />
              </Field>
            )}

            <Field label="Profile Photo" hint={fileErr.photo || files.photo?.name}>
              <input type="file" accept="image/*" onChange={handleFile("photo")} className="text-xs !p-2" />
            </Field>
          </Section>

          <Section n="2" title="Identification" sectionRef={idRef}>
            <div className="rounded-xl p-3 mb-4 border" style={{ background: "rgba(78,155,255,0.06)", borderColor: "rgba(78,155,255,0.2)" }}>
              <p className="text-[11px] text-blue">Your Emirates ID number is kept private and is visible only to authorised tournament administrators.</p>
            </div>
            <Field label="Emirates ID Number" required={settings?.emirates_id_required}>
              <input value={form.emiratesId} onChange={set("emiratesId")} required={settings?.emirates_id_required} />
            </Field>
            <Field label="Emirates ID Expiry Date">
              <input type="date" value={form.emiratesIdExpiry} onChange={set("emiratesIdExpiry")} />
            </Field>
          </Section>

          <Section n="3" title="Cricket Information" sectionRef={cricketRef}>
            <Field label="CricHeroes Profile Link" required={settings?.cricheroes_required} hint="Mandatory">
              <input value={form.cricheroes} onChange={set("cricheroes")} placeholder="https://cricheroes.com/player/..." required={settings?.cricheroes_required} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Primary Playing Role" required>
                <select value={form.role} onChange={set("role")}>{PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
              <Field label="Batting Style">
                <select value={form.battingStyle} onChange={set("battingStyle")}>{BATTING_STYLES.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bowling Style"><input value={form.bowlingStyle} onChange={set("bowlingStyle")} placeholder="e.g. Right-arm medium" /></Field>
              <Field label="Preferred Batting Position"><input value={form.battingPosition} onChange={set("battingPosition")} /></Field>
            </div>
            <Field label="Current Team"><input value={form.currentTeam} onChange={set("currentTeam")} /></Field>
          </Section>

          <Section n="4" title={`Payment — ${currency} ${fee}`} sectionRef={paymentSectionRef}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Payment Method" required>
                <select value={form.paymentMethod} onChange={set("paymentMethod")} required>
                  <option value="">Select</option>
                  <option>Bank Transfer</option><option>Ziina</option>
                </select>
              </Field>
              <Field label="Payment Reference"><input value={form.paymentRef} onChange={set("paymentRef")} /></Field>
            </div>

            {form.paymentMethod === "Bank Transfer" && (
              <div className="rounded-xl p-4 mb-5 border" style={{ background: "rgba(212,175,55,0.05)", borderColor: "rgba(212,175,55,0.25)" }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3 text-orange">Bank Account Details</div>
                <div className="text-sm space-y-1.5 text-navyText">
                  {settings?.bank_account_name && <div><span className="text-slateText">Account Name: </span>{settings.bank_account_name}</div>}
                  {settings?.bank_name && <div><span className="text-slateText">Bank: </span>{settings.bank_name}</div>}
                  {settings?.bank_account_number && <div><span className="text-slateText">Account Number: </span>{settings.bank_account_number}</div>}
                  {settings?.bank_iban && <div><span className="text-slateText">IBAN: </span>{settings.bank_iban}</div>}
                  {!settings?.bank_account_name && !settings?.bank_name && (
                    <div className="text-slateText">Bank details have not been set up yet — please contact the organising committee.</div>
                  )}
                </div>
              </div>
            )}

            {form.paymentMethod === "Ziina" && (
              <div className="rounded-xl p-4 mb-5 border text-center" style={{ background: "rgba(212,175,55,0.05)", borderColor: "rgba(212,175,55,0.25)" }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3 text-orange">Scan to Pay with Ziina</div>
                {settings?.ziina_qr_path ? (
                  <img
                    src={supabase.storage.from("payment-assets").getPublicUrl(settings.ziina_qr_path).data.publicUrl}
                    alt="Ziina QR Code"
                    className="w-48 h-48 mx-auto rounded-xl border border-black/10 bg-white p-2"
                  />
                ) : (
                  <div className="text-sm text-slateText">Ziina QR code has not been set up yet — please contact the organising committee.</div>
                )}
              </div>
            )}

            <Field label="Upload Payment Screenshot" required hint={fileErr.receipt || files.receipt?.name || "Required — upload proof of your bank transfer or Ziina payment"}>
              <input type="file" accept="image/*,.pdf" onChange={handleFile("receipt")} className="text-xs !p-2" required />
            </Field>
          </Section>

          <div ref={declarationRef} className="scroll-mt-32">
            <div className="rounded-xl p-5 mb-5 text-xs leading-relaxed text-slateText bg-white border border-black/5 border-l-4" style={{ borderLeftColor: "#D4AF37" }}>
              {settings?.terms_and_conditions}
            </div>

            <label className="flex items-start gap-3 mb-6 p-4 rounded-xl border cursor-pointer text-sm text-navyText bg-white" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
              <input
                type="checkbox"
                checked={form.declarationAccepted}
                onChange={(e) => setForm((f) => ({ ...f, declarationAccepted: e.target.checked }))}
                className="mt-0.5 !w-auto"
              />
              <span>I have read and agree to the tournament eligibility rules, auction conditions and the non-refundable {currency} {fee} registration fee.</span>
            </label>

            {formErr && <div className="text-xs mb-3 font-semibold text-red bg-red/10 rounded-lg p-3">{formErr}</div>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full !py-4 !text-base tracking-wide shadow-[0_10px_40px_rgba(212,175,55,0.3)]"
              disabled={!form.declarationAccepted || submitting}
            >
              {submitting ? "Submitting…" : "Complete Registration →"}
            </Button>
          </div>
        </form>
      </div>

      <SponsorsFooter sponsors={sponsors} />
    </div>
  );
}
