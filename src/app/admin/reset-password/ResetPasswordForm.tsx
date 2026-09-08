"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui";

export default function ResetPasswordForm({ code }: { code: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(!!code);
  const [ready, setReady] = useState(false);
  const [checkErr, setCheckErr] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyErr, setVerifyErr] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function tryLinkExchange() {
      if (!code) {
        setChecking(false);
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      if (error) {
        setCheckErr(error.message);
      } else {
        setReady(true);
      }
      setChecking(false);
    }

    tryLinkExchange();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyErr("");
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "recovery" });
    setVerifying(false);
    if (error) {
      setVerifyErr(error.message);
    } else {
      setReady(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErr(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0A0F1C" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-gold">
            <Logo className="w-full h-full" />
          </div>
          <h1 className="text-xl font-bold font-display text-white">Set Your Password</h1>
        </div>

        <div className="rounded-2xl border border-line bg-bgCard p-6">
          {done ? (
            <div className="text-center text-sm text-green">Password set! Redirecting you to sign in…</div>
          ) : checking ? (
            <div className="text-center text-sm text-mutedDim">Checking your link…</div>
          ) : ready ? (
            <form onSubmit={handleSubmit}>
              <label className="block mb-4">
                <span className="block text-xs font-bold uppercase tracking-wide mb-2 text-mutedDim">New Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </label>
              <label className="block mb-4">
                <span className="block text-xs font-bold uppercase tracking-wide mb-2 text-mutedDim">Confirm Password</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </label>
              {err && <div className="text-xs mb-3 text-red">{err}</div>}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Set Password"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              {checkErr && (
                <div className="text-xs mb-3 p-2 rounded-lg text-orange" style={{ background: "rgba(255,122,61,0.1)" }}>
                  Your link has expired or was already used (this can happen if your email provider automatically scans links before you click them). Enter the 6-digit code from that same email instead.
                </div>
              )}
              <p className="text-xs text-mutedDim mb-4">
                Ask a Super Admin to click &quot;Send password recovery&quot; for your account, then check your email for a 6-digit code and enter it below.
              </p>
              <label className="block mb-4">
                <span className="block text-xs font-bold uppercase tracking-wide mb-2 text-mutedDim">Your Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="block mb-4">
                <span className="block text-xs font-bold uppercase tracking-wide mb-2 text-mutedDim">6-Digit Code</span>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} required inputMode="numeric" maxLength={6} placeholder="123456" />
              </label>
              {verifyErr && <div className="text-xs mb-3 text-red">{verifyErr}</div>}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={verifying}>
                {verifying ? "Verifying…" : "Verify Code"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
