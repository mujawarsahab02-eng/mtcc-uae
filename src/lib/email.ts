// Shared Resend email helper — server-only, since it uses the private API
// key. Both the registration notification and the admin broadcast tool
// call this same function.
export async function sendEmail({
  to,
  bcc,
  subject,
  html,
  from,
}: {
  to?: string | string[];
  bcc?: string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured on the server." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || "MTCC UAE <noreply@mtccuae.com>",
      to: to || undefined,
      bcc: bcc || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `Email send failed: ${text}` };
  }
  return { ok: true };
}
