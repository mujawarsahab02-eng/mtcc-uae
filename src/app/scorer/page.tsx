"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field } from "@/components/ui";
import Logo from "@/components/Logo";
import { toLoginEmail } from "@/lib/scorerAuth";
import { registerAccount, signupNeedsCode } from "./actions";

export default function ScorerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { signupNeedsCode().then(setNeedsCode).catch(() => {}); }, []);

  async function signIn(user: string, pass: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(user), password: pass });
    if (error) { setErr(error.message === "Invalid login credentials" ? "Wrong email, mobile number or password." : error.message); return false; }
    router.push("/admin/fixtures");
    router.refresh();
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    if (mode === "register") {
      const res: any = await registerAccount({ fullName, identifier, password, code });
      if (res?.error) { setErr(res.error); setBusy(false); return; }
    }
    await signIn(identifier, password);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_0%,#16213D_0%,#0A0F1C_60%)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center mb-4 border-2 border-gold bg-bgCard shadow-[0_0_30px_rgba(212,175,55,0.3)] overflow-hidden">
            <Logo className="w-full h-full" />
          </div>
          <h1 className="text-xl font-bold font-display">MTCC U.A.E. Account</h1>
          <p className="text-xs text-mutedDim mt-1">Sign in or create an account to score live matches from your phone</p>
        </div>
        <Card className="p-6">
          <div className="flex gap-2 mb-4">
            <Button type="button" size="sm" variant={mode === "signin" ? "primary" : "subtle"} className="flex-1" onClick={() => { setMode("signin"); setErr(""); }}>Sign in</Button>
            <Button type="button" size="sm" variant={mode === "register" ? "primary" : "subtle"} className="flex-1" onClick={() => { setMode("register"); setErr(""); }}>Create account</Button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label="Full name" required><input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" /></Field>
            )}
            <Field label="Email or mobile number" required><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoCapitalize="none" autoComplete="username" placeholder="name@email.com or 05XXXXXXXX" /></Field>
            <Field label="Password" required hint={mode === "register" ? "At least 8 characters" : undefined}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "register" ? "new-password" : "current-password"} /></Field>
            {mode === "register" && needsCode && (
              <Field label="Access code" required hint="Given to you by the organisers"><input value={code} onChange={(e) => setCode(e.target.value)} required autoCapitalize="none" /></Field>
            )}
            {err && <div className="text-xs mb-3 text-red">{err}</div>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
