"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push(params.get("next") || "/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_0%,#16213D_0%,#0A0F1C_60%)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4 border-2 border-gold bg-bgCard">
            <span className="font-display font-bold text-2xl text-gold">MTCC</span>
          </div>
          <h1 className="text-xl font-bold font-display">Maharashtra Tennis Cricket Championship UAE</h1>
        </div>
        <Card className="p-6">
          <div className="text-xs uppercase tracking-wide font-semibold mb-4 text-muted">Sign In</div>
          <form onSubmit={handleLogin}>
            <Field label="Email" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" required>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            {err && <div className="text-xs mb-3 text-red">{err}</div>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="text-[11px] mt-4 text-mutedDim">
            Accounts are created and role-assigned by a Super Admin (Supabase Dashboard → Authentication, then /admin/users). There is no self-service sign-up for admin roles.
          </p>
        </Card>
      </div>
    </div>
  );
}
