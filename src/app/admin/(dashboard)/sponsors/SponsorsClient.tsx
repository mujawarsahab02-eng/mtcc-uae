"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, SectionHeader, SeamDivider } from "@/components/ui";
import { addSponsor, updateSponsor, deleteSponsor } from "./actions";

export default function SponsorsClient({ initialSponsors, canManage }: { initialSponsors: any[]; canManage: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function logoUrl(path: string | null) {
    if (!path) return null;
    return supabase.storage.from("sponsor-logos").getPublicUrl(path).data.publicUrl;
  }

  function resetForm() {
    setName(""); setWebsiteUrl(""); setLogoFile(null); setErr(""); setAdding(false); setEditing(null);
  }

  async function handleAdd() {
    setBusy(true); setErr("");
    try {
      let logoPath: string | null = null;
      if (logoFile) {
        const path = `${crypto.randomUUID()}-${logoFile.name.replace(/\s+/g, "_")}`;
        const { error } = await supabase.storage.from("sponsor-logos").upload(path, logoFile);
        if (error) throw new Error(error.message);
        logoPath = path;
      }
      const res: any = await addSponsor(name, logoPath, websiteUrl || null);
      if (res.error) throw new Error(res.error);
      resetForm();
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(sponsor: any) {
    setBusy(true); setErr("");
    try {
      let logoPath = sponsor.logo_path;
      if (logoFile) {
        const path = `${crypto.randomUUID()}-${logoFile.name.replace(/\s+/g, "_")}`;
        const { error } = await supabase.storage.from("sponsor-logos").upload(path, logoFile);
        if (error) throw new Error(error.message);
        logoPath = path;
      }
      const res: any = await updateSponsor(sponsor.id, { name, website_url: websiteUrl || null, logo_path: logoPath });
      if (res.error) throw new Error(res.error);
      setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? { ...s, name, website_url: websiteUrl, logo_path: logoPath } : s)));
      resetForm();
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    const res: any = await deleteSponsor(id);
    setBusy(false);
    if (!res.error) {
      setSponsors((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  }

  function startEdit(sponsor: any) {
    setEditing(sponsor);
    setName(sponsor.name);
    setWebsiteUrl(sponsor.website_url || "");
    setLogoFile(null);
    setAdding(false);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Admin"
        title="Sponsors"
        action={canManage && !adding && !editing && <Button variant="primary" onClick={() => { setAdding(true); setName(""); setWebsiteUrl(""); setLogoFile(null); }}>Add Sponsor</Button>}
      />
      <SeamDivider />

      {!canManage && (
        <Card className="p-3 mb-5 text-xs text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Read-only for your role. Only Super Admin and Tournament Admin can manage sponsors.
        </Card>
      )}

      {(adding || editing) && (
        <Card className="p-5 mb-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-4 text-muted">{editing ? "Edit Sponsor" : "New Sponsor"}</div>
          <Field label="Sponsor Name" required><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Website URL (optional)"><input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." /></Field>
          <Field label="Logo" hint={logoFile?.name || (editing?.logo_path ? "Leave blank to keep current logo" : undefined)}>
            <input type="file" accept="image/*" className="text-xs !p-0" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          </Field>
          {err && <div className="text-xs mb-3 text-red">{err}</div>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => (editing ? handleUpdate(editing) : handleAdd())} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : editing ? "Save Changes" : "Add Sponsor"}
            </Button>
            <Button variant="ghost" onClick={resetForm} disabled={busy}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sponsors.length === 0 && <Card className="p-8 text-center text-sm text-mutedDim col-span-full">No sponsors added yet.</Card>}
        {sponsors.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-bgCardHover overflow-hidden border border-line">
                {s.logo_path ? <img src={logoUrl(s.logo_path)!} alt={s.name} className="w-full h-full object-contain p-1" /> : <span className="text-mutedDim text-xs">No logo</span>}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{s.name}</div>
                {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue underline truncate block">{s.website_url}</a>}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="subtle" size="sm" onClick={() => startEdit(s)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)} disabled={busy}>Remove</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
