"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { SETTINGS_EDIT_ROLES } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export async function sendBroadcast(subject: string, message: string): Promise<any> {
  const profile = await getCurrentProfile();
  if (!profile || !SETTINGS_EDIT_ROLES.includes(profile.role)) {
    return { error: "Only Super Admin and Tournament Admin can send broadcasts." };
  }
  if (!subject.trim() || !message.trim()) {
    return { error: "Please enter both a subject and a message." };
  }

  const supabase = createClient();
  const { data: players } = await supabase.from("players").select("email").not("email", "is", null).neq("email", "");
  const emails = Array.from(new Set((players ?? []).map((p: any) => p.email).filter(Boolean))) as string[];

  if (!emails.length) return { error: "No player email addresses found." };

  const batchSize = 50;
  let sentCount = 0;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const res = await sendEmail({
      to: "MTCC UAE <noreply@mtccuae.com>",
      bcc: batch,
      subject,
      html: `<div style="font-family: sans-serif; white-space: pre-line;">${message}</div>`,
    });
    if (!res.error) sentCount += batch.length;
  }

  await logAudit({ action: "Broadcast Email Sent", entity: "Broadcast", entityId: "broadcast", field: "subject", previousValue: "—", newValue: subject });
  return { ok: true, sentCount, totalCount: emails.length };
}
