"use client";

import { useState } from "react";
import { LightButton, LightCard, LightField, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";
import { sendBroadcast } from "./actions";

export default function BroadcastClient({ currentRole, canSend }: { currentRole: string; canSend: boolean }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  async function handleSend() {
    if (!window.confirm("Send this email to every registered player with an email address on file? This cannot be undone.")) return;
    setSending(true);
    setErr("");
    setResult("");
    const res: any = await sendBroadcast(subject, message);
    setSending(false);
    if (res.error) setErr(res.error);
    else {
      setResult(`Sent to ${res.sentCount} of ${res.totalCount} players.`);
      setSubject("");
      setMessage("");
    }
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin" title="Send Update to Players" />
      <LightSeamDivider />

      {!canSend ? (
        <LightCard className="p-4 text-sm text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Your role ({currentRole}) cannot send broadcasts. Only Super Admin and Tournament Admin can.
        </LightCard>
      ) : (
        <LightCard className="p-5">
          <p className="text-[11px] text-slateText mb-4">
            This sends one email to every registered player who has an email address on file. Use it for important updates — auction date, results, major announcements. There&apos;s no undo once sent.
          </p>
          <LightField label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Auction Day Confirmed — Sept 20th" />
          </LightField>
          <LightField label="Message">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Write your update here..." />
          </LightField>
          {err && <div className="text-xs mb-3 text-red">{err}</div>}
          {result && <div className="text-xs mb-3 text-green">{result}</div>}
          <LightButton variant="primary" onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? "Sending…" : "Send to All Players"}
          </LightButton>
        </LightCard>
      )}
    </div>
  );
}
