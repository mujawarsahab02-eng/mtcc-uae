"use server";

import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { toLoginEmail, looksLikePhone, normalisePhone } from "@/lib/scorerAuth";

function sameCode(a: string, b: string) {
  const x = Buffer.from(a.trim()), y = Buffer.from(b.trim());
  return x.length === y.length && timingSafeEqual(x, y);
}

// Sign-up is open to everyone. If the organisers set SCORER_SIGNUP_CODE in
// Vercel, a code is required (a quick way to lock sign-up down if needed).
export async function signupNeedsCode(): Promise<boolean> {
  return !!process.env.SCORER_SIGNUP_CODE;
}

export async function registerAccount(input: {
  fullName: string; identifier: string; password: string; code?: string;
}): Promise<any> {
  const secret = process.env.SCORER_SIGNUP_CODE;
  if (secret && !sameCode(input.code || "", secret)) return { error: "That access code is not correct." };

  const fullName = (input.fullName || "").trim();
  const id = (input.identifier || "").trim();
  if (fullName.length < 3) return { error: "Please enter your full name." };
  if ((input.password || "").length < 8) return { error: "Password must be at least 8 characters." };

  let mobile: string | null = null;
  if (id.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return { error: "Please enter a valid email address." };
  } else if (looksLikePhone(id)) {
    mobile = normalisePhone(id);
  } else {
    return { error: "Enter your email address or mobile number." };
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.auth.admin.createUser({
    email: toLoginEmail(id),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data?.user) {
    const taken = /already|registered|exists/i.test(error?.message || "");
    return { error: taken ? "An account with that email or number already exists. Please sign in." : (error?.message || "Could not create the account.") };
  }

  // The new-user trigger creates a Viewer profile; store it as a Scorer.
  const { error: pErr } = await service.from("profiles").update({ role: "Scorer", full_name: fullName, mobile }).eq("id", data.user.id);
  if (pErr) return { error: "Account created but the role could not be saved. Tell the organisers: " + pErr.message };
  return { ok: true };
}
