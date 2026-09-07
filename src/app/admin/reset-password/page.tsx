"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase's client automatically parses the recovery token from the
    // URL fragment and establishes a temporary session for this page —
    // we just wait for that before showing the "set password" form.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Fallback in case the session was already established by the time
    // this component mounted, before the listener above was attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [supabase]);

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
          ) : !ready ? (
            <div className="text-center text-sm text-mutedDim">
              Checking your link… If this doesn&apos;t update in a few seconds, the link may have expired — ask a Super Admin to send you a new one.
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
