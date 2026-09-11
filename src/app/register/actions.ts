"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Best-effort admin notification — never blocks or breaks registration if
// it fails, since the core registration record is already saved by the
// time this runs. Silently does nothing if no notification email is set.
export async function notifyAdminOfRegistration(
  fullName: string,
  mobile: string,
  playerType: string
): Promise<any> {
  try {
    const supabase = createClient();
    const { data: settings } = await supabase
      .from("tournament_settings")
      .select("admin_notification_email, tournament_name")
      .eq("id", 1)
      .single();

    const adminEmail = settings?.admin_notification_email;
    if (!adminEmail) return { ok: true };

    await sendEmail({
      to: adminEmail,
      subject: `New Player Registration — ${fullName}`,
      html: `
        <div style="font-family: sans-serif;">
          <h2>New Player Registration</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Mobile:</strong> ${mobile}</p>
          <p><strong>Player Type:</strong> ${playerType}</p>
          <p>Log in to admin to review this registration.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
