"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, FormSection } from "@/components/ui";
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
    <div className="min-h-screen pb-16">
      <div className="border-b border-line sticky top-0 z-20 backdrop-blur bg-bg/90">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-orange">Player Registration</div>
          <div className="font-bold text-sm font-display">Maharashtra Tennis Cricket Championship UAE</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6">
        <Card className="p-4 mb-6" style={{ background: "rgba(255,122,61,0.06)", borderColor: "rgba(255,122,61,0.3)" }}>
          <div className="text-sm font-bold mb-2 font-display text-orange">Registration Fee: {currency} {fee}</div>
          <ul className="text-xs space-y-1.5 text-muted">
            <li>• Registration does not guarantee selection in the auction.</li>
            <li>• The player registration fee is non-refundable even if the player is not selected.</li>
            <li>• No salary or auction money will be paid to players.</li>
            <li>• 🎽 {shirtNote}</li>
            {typeof spotsRemaining === "number" && <li>• {spotsRemaining} registration {spotsRemaining === 1 ? "spot" : "spots"} remaining.</li>}
          </ul>
        </Card>

        <form onSubmit={handleSubmit}>
          <FormSection title="Personal Details">
            <Field label="Full Name (as per Emirates ID)" required>
              <input value={form.fullName} onChange={set("fullName")} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth" required>
                <input type="date" value={form.dob} onChange={set("dob")} required />
              </Field>
              <Field label="Nationality" hint="Required to be Indian for this category">
                <input value="Indian" disabled />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mobile Number" required>
                <input value={form.mobile} onChange={set("mobile")} required />
              </Field>
              <Field label="WhatsApp Number">
                <input value={form.whatsapp} onChange={set("whatsapp")} />
              </Field>
            </div>
            <Field label="Email Address">
              <input type="email" value={form.email} onChange={set("email")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
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
              <input type="file" accept="image/*" onChange={handleFile("photo")} className="text-xs !p-0" />
            </Field>
          </FormSection>

          <FormSection title="Identification">
            <Card className="p-3 mb-4" style={{ background: "rgba(78,155,255,0.06)", borderColor: "rgba(78,155,255,0.25)" }}>
              <p className="text-[11px] text-blue">Your Emirates ID number is kept private and is visible only to authorised tournament administrators.</p>
            </Card>
            <Field label="Emirates ID Number" required={settings?.emirates_id_required}>
              <input value={form.emiratesId} onChange={set("emiratesId")} required={settings?.emirates_id_required} />
            </Field>
            <Field label="Emirates ID Expiry Date">
              <input type="date" value={form.emiratesIdExpiry} onChange={set("emiratesIdExpiry")} />
            </Field>
          </FormSection>

          <FormSection title="Cricket Information">
            <Field label="CricHeroes Profile Link" required={settings?.cricheroes_required} hint="Mandatory">
              <input value={form.cricheroes} onChange={set("cricheroes")} placeholder="https://cricheroes.com/player/..." required={settings?.cricheroes_required} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary Playing Role" required>
                <select value={form.role} onChange={set("role")}>{PLAYING_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
              <Field label="Batting Style">
                <select value={form.battingStyle} onChange={set("battingStyle")}>{BATTING_STYLES.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bowling Style"><input value={form.bowlingStyle} onChange={set("bowlingStyle")} placeholder="e.g. Right-arm medium" /></Field>
              <Field label="Preferred Batting Position"><input value={form.battingPosition} onChange={set("battingPosition")} /></Field>
            </div>
            <Field label="Current Team"><input value={form.currentTeam} onChange={set("currentTeam")} /></Field>
          </FormSection>

          <FormSection title={`Payment — ${currency} ${fee}`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment Method">
                <select value={form.paymentMethod} onChange={set("paymentMethod")}>
                  <option value="">Select</option>
                  <option>Bank Transfer</option><option>Cash</option>
                </select>
              </Field>
              <Field label="Payment Reference"><input value={form.paymentRef} onChange={set("paymentRef")} /></Field>
            </div>

            {form.paymentMethod === "Bank Transfer" && (
              <Card className="p-4 mb-4" style={{ background: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.3)" }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-3 text-goldBright">Bank Account Details</div>
                <div className="text-sm space-y-1.5 text-muted">
                  {settings?.bank_account_name && <div><span className="text-mutedDim">Account Name: </span>{settings.bank_account_name}</div>}
                  {settings?.bank_name && <div><span className="text-mutedDim">Bank: </span>{settings.bank_name}</div>}
                  {settings?.bank_account_number && <div><span className="text-mutedDim">Account Number: </span>{settings.bank_account_number}</div>}
                  {settings?.bank_iban && <div><span className="text-mutedDim">IBAN: </span>{settings.bank_iban}</div>}
                  {!settings?.bank_account_name && !settings?.bank_name && (
                    <div className="text-mutedDim">Bank details have not been set up yet — please contact the organising committee.</div>
                  )}
                </div>
              </Card>
            )}

            <Field label="Upload Payment Receipt" hint={fileErr.receipt || files.receipt?.name}>
              <input type="file" accept="image/*,.pdf" onChange={handleFile("receipt")} className="text-xs !p-0" />
            </Field>
          </FormSection>

          <Card className="p-4 mb-4 text-xs leading-relaxed text-mutedDim">
            {settings?.terms_and_conditions}
          </Card>

          <label className="flex items-start gap-2 mb-4 text-xs cursor-pointer text-muted">
            <input
              type="checkbox"
              checked={form.declarationAccepted}
              onChange={(e) => setForm((f) => ({ ...f, declarationAccepted: e.target.checked }))}
              className="mt-0.5 !w-auto"
            />
            <span>I have read and agree to the tournament eligibility rules, auction conditions and the non-refundable {currency} {fee} registration fee.</span>
          </label>

          {formErr && <div className="text-xs mb-3 font-semibold text-red">{formErr}</div>}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!form.declarationAccepted || submitting}>
            {submitting ? "Submitting…" : "Submit Registration"}
          </Button>
        </form>
      </div>
    </div>
  );
}
