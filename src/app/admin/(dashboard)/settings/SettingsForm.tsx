"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, FormSection, SectionHeader, SeamDivider } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { saveSettings } from "./actions";
import { applyPurseToAllTeams } from "../teams/actions";

export default function SettingsForm({ settings, canEdit, canToggleOverseas, currentRole }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<Record<string, any>>(settings ?? {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingPurse, setApplyingPurse] = useState(false);
  const [purseMsg, setPurseMsg] = useState("");
  const [poweredByLogoFile, setPoweredByLogoFile] = useState<File | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setDraft((d) => ({ ...d, [k]: val }));
  };
  const setNum = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }));

  async function handleSave() {
    setSaving(true);
    let finalDraft = draft;
    if (poweredByLogoFile) {
      const path = `powered-by-${crypto.randomUUID()}-${poweredByLogoFile.name.replace(/\s+/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("sponsor-logos").upload(path, poweredByLogoFile);
      if (!uploadError) finalDraft = { ...draft, powered_by_logo_path: path };
    }
    const saveResult: any = await saveSettings(finalDraft);
    const { error } = saveResult;
    setSaving(false);
    if (!error) {
      setSaved(true);
      setPoweredByLogoFile(null);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleApplyPurseToAll() {
    setApplyingPurse(true);
    setPurseMsg("");
    const res: any = await applyPurseToAllTeams(Number(draft.auction_points_per_team ?? 1000));
    setApplyingPurse(false);
    if (res.error) setPurseMsg(res.error);
    else { setPurseMsg("Applied to all teams ✓"); router.refresh(); setTimeout(() => setPurseMsg(""), 3000); }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Admin"
        title="Tournament Settings"
        action={canEdit && <Button variant="primary" onClick={handleSave} disabled={saving}>{saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}</Button>}
      />
      <SeamDivider />

      {!canEdit && (
        <Card className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Your role ({currentRole}) has read-only access to Tournament Settings. Only Super Admin and Tournament Admin can make changes. This is enforced by the database (RLS), not just hidden in the UI.
        </Card>
      )}

      <fieldset disabled={!canEdit} style={{ opacity: canEdit ? 1 : 0.6 }}>
        <FormSection title="General">
          <Field label="Tournament Name"><input value={draft.tournament_name || ""} onChange={set("tournament_name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Season Label"><input value={draft.season || ""} onChange={set("season")} /></Field>
