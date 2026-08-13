"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
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
} | null;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

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

// Premium editorial section wrapper: numbered gold badge + serif title +
// hairline divider, used only on the public registration page.
function LuxSection({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-full border border-gold flex items-center justify-center shrink-0">
          <span className="font-serif-lux text-xs text-goldBright">{n}</span>
        </div>
        <h2 className="font-serif-lux text-lg sm:text-xl italic text-ink tracking-wide">{title}</h2>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.5), transparent)" }} />
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function LuxField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 text-mutedDim">
        {label} {required && <span className="text-orange">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] mt-1.5 text-mutedDim italic">{hint}</span>}
    </label>
  );
}

function IconRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ background: "rgba(212,175,55,0.12)" }}>
        {icon}
      </div>
      <div className="text-sm text-muted leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}

export default function RegisterForm({ settings, closed, spotsRemaining }: { settings: Settings; closed?: boolean; spotsRemaining?: number }) {
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl bg-orange/15 text-orange">✕</div>
          <h2 className="text-xl font-bold mb-2 font-display">Registration Closed</h2>
          <p className="text-sm leading-relaxed text-muted">
            Player registration has reached its maximum capacity for this season. Thank you to everyone who registered — approved players will be contacted ahead of the auction.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-bg">
      {/* Premium hero banner */}
      <div className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% -10%, rgba(212,175,55,0.18) 0%, transparent 55%), linear-gradient(180deg, #0F1729 0%, #0A0F1C 100%)" }}
        />
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" preserveAspectRatio="none">
          <defs>
            <pattern id="hairline" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M0 26 L26 0" stroke="#D4AF37" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hairline)" />
        </svg>

        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-10 text-center">
          <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-5 overflow-hidden" style={{ border: "1px solid rgba(212,175,55,0.6)", boxShadow: "0 0 0 4px rgba(212,175,55,0.08)" }}>
            <img src="/logo.png" alt="MTCC UAE" className="w-full h-full object-contain p-0" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] font-semibold mb-3 text-orange">Player Registration</div>
          <h1 className="font-serif-lux italic text-2xl sm:text-3xl text-ink mb-2 leading-snug">
            Maharashtra Tennis Cricket<br className="hidden sm:block" /> Championship UAE
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="w-10 h-px" style={{ background: "linear-gradient(90deg, transparent, #D4AF37)" }} />
            <span className="text-goldBright text-xs">✦</span>
            <div className="w-10 h-px" style={{ background: "linear-gradient(270deg, transparent, #D4AF37)" }} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Fee & perks — refined ticket-style card */}
        <div
          className="rounded-2xl border p-6 mb-10 relative overflow-hidden"
          style={{ borderColor: "rgba(212,175,55,0.3)", background: "linear-gradient(160deg, rgba(212,175,55,0.07), rgba(255,122,61,0.04))" }}
        >
          <div className="text-center mb-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-mutedDim mb-1">Registration Fee</div>
            <div className="font-serif-lux text-4xl text-goldBright">{currency} {fee}</div>
            {typeof spotsRemaining === "number" && (
              <div className="text-[11px] text-mutedDim mt-1">{spotsRemaining} registration {spotsRemaining === 1 ? "spot" : "spots"} remaining this season</div>
            )}
          </div>
          <div className="w-full h-px my-4" style={{ background: "rgba(212,175,55,0.2)" }} />
          <IconRow icon="📋">Registration does not guarantee selection in the auction.</IconRow>
          <IconRow icon="🔒">The registration fee is non-refundable even if the player is not selected.</IconRow>
          <IconRow icon="💰">No salary or auction money will be paid to players.</IconRow>
          <IconRow icon="🎽">{shirtNote}</IconRow>
        </div>

        <form onSubmit={handleSubmit}>
          <LuxSection n="01" title="Personal Details">
            <LuxField label="Full Name (as per Emirates ID)" required>
              <input value={form.fullName} onChange={set("fullName")} required />
            </LuxField>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Date of Birth" required>
                <input type="date" value={form.dob} onChange={set("dob")} required />
              </LuxField>
              <LuxField label="Nationality" hint="Required to be Indian for this category">
                <input value="Indian" disabled />
              </LuxField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Mobile Number" required>
                <input value={form.mobile} onChange={set("mobile")} required />
              </LuxField>
              <LuxField label="WhatsApp Number">
                <input value={form.whatsapp} onChange={set("whatsapp")} />
              </LuxField>
            </div>
            <LuxField label="Email Address">
              <input type="email" value={form.email} onChange={set("email")} />
            </LuxField>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Current Emirate" required>
                <select value={form.emirate} onChange={set("emirate")} required>
                  <option value="">Select</option>
                  {EMIRATES.map((e) => <option key={e}>{e}</option>)}
                </select>
              </LuxField>
              <LuxField label="Current UAE Location">
                <input value={form.uaeLocation} onChange={set("uaeLocation")} />
              </LuxField>
            </div>

            <LuxField label="Player Type" required>
              <select value={form.playerType} onChange={set("playerType")}>
                {PLAYER_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </LuxField>
            {form.playerType === "Maharashtra Player" ? (
              <LuxField label="Maharashtra District / Home Town" required>
                <input value={form.district} onChange={set("district")} required />
              </LuxField>
            ) : (
              <LuxField label="State in India" required>
                <input value={form.state} onChange={set("state")} required />
              </LuxField>
            )}

            <LuxField label="Profile Photo" hint={fileErr.photo || files.photo?.name}>
              <input type="file" accept="image/*" onChange={handleFile("photo")} className="text-xs !p-0" />
            </LuxField>
          </LuxSection>

          <LuxSection n="02" title="Identification">
            <div className="rounded-xl p-3 mb-4 border" style={{ background: "rgba(78,155,255,0.06)", borderColor: "rgba(78,155,255,0.25)" }}>
              <p className="text-[11px] text-blue">Your Emirates ID number is kept private and is visible only to authorised tournament administrators.</p>
            </div>
            <LuxField label="Emirates ID Number" required={settings?.emirates_id_required}>
              <input value={form.emiratesId} onChange={set("emiratesId")} required={settings?.emirates_id_required} />
            </LuxField>
            <LuxField label="Emirates ID Expiry Date">
              <input type="date" value={form.emiratesIdExpiry} onChange={set("emiratesIdExpiry")} />
            </LuxField>
          </LuxSection>

          <LuxSection n="03" title="Cricket Information">
            <LuxField label="CricHeroes Profile Link" required={settings?.cricheroes_required} hint="Mandatory">
              <input value={form.cricheroes} onChange={set("cricheroes")} placeholder="https://cricheroes.com/player/..." required={settings?.cricheroes_required} />
            </LuxField>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Primary Playing Role" required>
                <select value={form.role} onChange={set("role")}>{PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </LuxField>
              <LuxField label="Batting Style">
                <select value={form.battingStyle} onChange={set("battingStyle")}>{BATTING_STYLES.map((r) => <option key={r}>{r}</option>)}</select>
              </LuxField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Bowling Style"><input value={form.bowlingStyle} onChange={set("bowlingStyle")} placeholder="e.g. Right-arm medium" /></LuxField>
              <LuxField label="Preferred Batting Position"><input value={form.battingPosition} onChange={set("battingPosition")} /></LuxField>
            </div>
            <LuxField label="Current Team"><input value={form.currentTeam} onChange={set("currentTeam")} /></LuxField>
          </LuxSection>

          <LuxSection n="04" title={`Payment — ${currency} ${fee}`}>
            <div className="grid grid-cols-2 gap-3">
              <LuxField label="Payment Method">
                <select value={form.paymentMethod} onChange={set("paymentMethod")}>
                  <option value="">Select</option>
                  <option>Bank Transfer</option><option>Cash</option>
                </select>
              </LuxField>
              <LuxField label="Payment Reference"><input value={form.paymentRef} onChange={set("paymentRef")} /></LuxField>
            </div>

            {form.paymentMethod === "Bank Transfer" && (
              <div className="rounded-xl p-4 mb-5 border" style={{ background: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.3)" }}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-3 text-goldBright">Bank Account Details</div>
                <div className="text-sm space-y-1.5 text-muted">
                  {settings?.bank_account_name && <div><span className="text-mutedDim">Account Name: </span>{settings.bank_account_name}</div>}
                  {settings?.bank_name && <div><span className="text-mutedDim">Bank: </span>{settings.bank_name}</div>}
                  {settings?.bank_account_number && <div><span className="text-mutedDim">Account Number: </span>{settings.bank_account_number}</div>}
                  {settings?.bank_iban && <div><span className="text-mutedDim">IBAN: </span>{settings.bank_iban}</div>}
                  {!settings?.bank_account_name && !settings?.bank_name && (
                    <div className="text-mutedDim">Bank details have not been set up yet — please contact the organising committee.</div>
                  )}
                </div>
              </div>
            )}

            <LuxField label="Upload Payment Receipt" hint={fileErr.receipt || files.receipt?.name}>
              <input type="file" accept="image/*,.pdf" onChange={handleFile("receipt")} className="text-xs !p-0" />
            </LuxField>
          </LuxSection>

          <div className="rounded-xl p-5 mb-5 text-xs leading-relaxed text-mutedDim border-l-2" style={{ borderColor: "#D4AF37", background: "rgba(255,255,255,0.02)" }}>
            {settings?.terms_and_conditions}
          </div>

          <label className="flex items-start gap-3 mb-6 p-4 rounded-xl border cursor-pointer text-sm text-muted" style={{ borderColor: "rgba(212,175,55,0.25)", background: "rgba(212,175,55,0.03)" }}>
            <input
              type="checkbox"
              checked={form.declarationAccepted}
              onChange={(e) => setForm((f) => ({ ...f, declarationAccepted: e.target.checked }))}
              className="mt-0.5 !w-auto"
            />
            <span>I have read and agree to the tournament eligibility rules, auction conditions and the non-refundable {currency} {fee} registration fee.</span>
          </label>

          {formErr && <div className="text-xs mb-3 font-semibold text-red">{formErr}</div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full !py-4 !text-base tracking-wide shadow-[0_10px_40px_rgba(212,175,55,0.3)]"
            disabled={!form.declarationAccepted || submitting}
          >
            {submitting ? "Submitting…" : "Complete Registration →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
