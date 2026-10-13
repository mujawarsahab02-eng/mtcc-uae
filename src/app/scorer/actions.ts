"use server";

import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { toLoginEmail } from "@/lib/scorerAuth";

function sameCode(a: string, b: string) {
  const x = Buffer.from(a.trim()), y = Buffer.from(b.trim());
  return x.length === y.length && timingSafeEqual(x, y);
}

// Creates a scorer account. Anyone with the scorer access code (shared by the
// organisers) can register; the account is stored with the Scorer role.
export async function registerScorer(input: {
  fullName: string; username: string; mobile: string; password: string; code: string;
}): Promise<any> {
  const secret = process.env.SCORER_SIGNUP_CODE;
  if (!secret) return { error: "Scorer sign-up is not open yet. Please ask the organisers." };
  if (!sameCode(input.code || "", secret)) return { error: "That scorer access code is not correct. Ask the organisers for the code." };

  const fullName = (input.fullName || "").trim();
  const username = (input.username || "").trim().toLowerCase();
  const mobile = (input.mobile || "").replace(/[^\d+]/g, "");
  if (fullName.length < 3) return { error: "Please enter your full name." };
  if (!/^[a-z0-9._]{3,20}$/.test(username)) return { error: "Username must be 3 to 20 letters, numbers, dots or underscores." };
  if (mobile.length < 8) return { error: "Please enter your mobile number." };
  if ((input.password || "").length < 8) return { error: "Password must be at least 8 characters." };

  const service = createServiceRoleClient();
  const { data, error } = await service.auth.admin.createUser({
    email: toLoginEmail(username),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data?.user) {
    const taken = /already|registered|exists/i.test(error?.message || "");
    return { error: taken ? "That username is taken. Please choose another." : (error?.message || "Could not create the account.") };
  }

  // The new-user trigger creates a Viewer profile; make it a Scorer.
  const { error: pErr } = await service.from("profiles").update({ role: "Scorer", full_name: fullName, mobile }).eq("id", data.user.id);
  if (pErr) return { error: "Account created but the Scorer role could not be saved. Tell the organisers: " + pErr.message };
  return { ok: true };
}
