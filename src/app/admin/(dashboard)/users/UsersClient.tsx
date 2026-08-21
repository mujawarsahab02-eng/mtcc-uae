"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LightBadge, LightButton, LightCard, LightField, LightSectionHeader, LightSeamDivider } from "@/components/ui/light";
import { USER_ROLES, type UserRole } from "@/lib/constants";
import { assignRole, inviteUser } from "./actions";

export default function UsersClient({ initialUsers, teams }: any) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("Viewer");
  const [inviteTeam, setInviteTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleInvite() {
    if (!inviteEmail) return;
    setBusy(true); setMsg("");
    const res: any = await inviteUser(inviteEmail, inviteRole, inviteRole === "Team Owner" ? inviteTeam || null : null);
    setBusy(false);
    if (res.error) setMsg(res.error);
    else { setInviteEmail(""); router.refresh(); }
  }

  async function handleRoleChange(userId: string, role: UserRole, teamId: string | null) {
    setUsers((prev: any[]) => prev.map((u) => (u.id === userId ? { ...u, role, teamId } : u)));
    await assignRole(userId, role, teamId);
    router.refresh();
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin · Super Admin Only" title="Users & Roles" />
      <LightSeamDivider />

      <LightCard className="p-3 mb-5 text-xs text-blue" style={{ borderColor: "rgba(78,155,255,0.2)", background: "rgba(78,155,255,0.05)" }}>
        Roles are assigned here by Super Admin only — nobody selects their own role at sign-in. Inviting a user sends
        a Supabase Auth invite email; they set their own password from that link, then sign in at /admin/login.
      </LightCard>

      <LightCard className="p-4 mb-6">
        <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Invite a New User</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div style={{ minWidth: 220 }}><LightField label="Email"><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></LightField></div>
          <div style={{ minWidth: 180 }}>
            <LightField label="Role">
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}>
                {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </LightField>
          </div>
          {inviteRole === "Team Owner" && (
            <div style={{ minWidth: 180 }}>
              <LightField label="Team">
                <select value={inviteTeam} onChange={(e) => setInviteTeam(e.target.value)}>
                  <option value="">Select team</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </LightField>
            </div>
          )}
          <LightButton variant="primary" onClick={handleInvite} disabled={busy || !inviteEmail}>{busy ? "Sending…" : "Send Invite"}</LightButton>
        </div>
        {msg && <div className="text-xs mt-2 text-red">{msg}</div>}
      </LightCard>

      <div className="space-y-2">
        {users.map((u: any) => (
          <LightCard key={u.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-navyText">{u.fullName || u.email}</div>
              <div className="text-[11px] text-slateText">{u.email}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {u.teamName && <LightBadge tone="blue">{u.teamName}</LightBadge>}
              <select
                value={u.role}
                onChange={(e) => {
                  const role = e.target.value as UserRole;
                  handleRoleChange(u.id, role, role === "Team Owner" ? u.teamId : null);
                }}
                style={{ width: 170 }}
              >
                {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              {u.role === "Team Owner" && (
                <select
                  value={u.teamId || ""}
                  onChange={(e) => handleRoleChange(u.id, "Team Owner", e.target.value || null)}
                  style={{ width: 160 }}
                >
                  <option value="">No team</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          </LightCard>
        ))}
      </div>
    </div>
  );
}
