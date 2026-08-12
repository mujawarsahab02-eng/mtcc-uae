/**
 * scripts/import-legacy-data.ts
 *
 * One-time helper for moving data OUT of the Claude Artifact prototype's
 * window.storage and INTO this Supabase project.
 *
 * There is no automatic connection between the artifact (a sandboxed
 * browser environment) and this codebase — nothing can reach into
 * window.storage from here. So the migration is a two-step manual export
 * + scripted import:
 *
 * STEP 1 — export from the artifact:
 *   Open the running artifact, then in the browser console run:
 *
 *     const players = JSON.parse((await window.storage.list('mtcc:player:')).keys
 *       ? await Promise.all((await window.storage.list('mtcc:player:')).keys.map(
 *           async k => (await window.storage.get(k.replace('mtcc:',''), true)).value))
 *       : []);
 *     copy(JSON.stringify(players));
 *
 *   (Adjust to however your artifact build stores keys — see the
 *   storage-layer notes in the artifact's App.jsx.) Paste the result into
 *   data/legacy-players.json. Do the same for teams into
 *   data/legacy-teams.json.
 *
 * STEP 2 — run this script against your Supabase project:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-legacy-data.ts
 *
 * This intentionally uses the service role key (bypasses RLS) since it's a
 * one-time administrative migration, not a user-facing flow. Never ship
 * this key to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function importTeams() {
  const file = path.join(__dirname, "..", "data", "legacy-teams.json");
  if (!fs.existsSync(file)) {
    console.log("No data/legacy-teams.json found — skipping teams import.");
    return new Map<string, string>();
  }
  const legacyTeams = JSON.parse(fs.readFileSync(file, "utf8"));
  const idMap = new Map<string, string>(); // old artifact id -> new uuid

  for (const t of legacyTeams) {
    const { data, error } = await supabase
      .from("teams")
      .insert({
        name: t.name,
        owner_name: t.ownerName,
        company: t.company,
        mobile: t.mobile,
        whatsapp: t.whatsapp,
        email: t.email,
        manager: t.manager,
        jersey_colour: t.jerseyColour,
        entry_fee_amount: t.entryFeeAmount ?? t.entryFee ?? 1500,
        amount_paid: t.amountPaid ?? 0,
        payment_status: t.paymentStatus ?? "Pending",
        payment_reference: t.paymentReference,
        payment_date: t.paymentDate || null,
        auction_points: t.auctionPoints ?? 1000,
        notes: t.notes,
        // logo/receipt files from the artifact were base64 blobs, not
        // storage paths — re-upload those manually via /admin/teams after
        // import, since this script does not decode/re-upload binaries.
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to import team "${t.name}":`, error.message);
      continue;
    }
    idMap.set(t.id, data.id);
    console.log(`Imported team: ${t.name}`);
  }
  return idMap;
}

async function importPlayers(teamIdMap: Map<string, string>) {
  const file = path.join(__dirname, "..", "data", "legacy-players.json");
  if (!fs.existsSync(file)) {
    console.log("No data/legacy-players.json found — skipping players import.");
    return;
  }
  const legacyPlayers = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const p of legacyPlayers) {
    const { error } = await supabase.from("players").insert({
      full_name: p.fullName,
      dob: p.dob || null,
      mobile: p.mobile,
      whatsapp: p.whatsapp,
      email: p.email,
      emirate: p.emirate,
      uae_location: p.uaeLocation,
      player_type: p.playerType || (p.category === "Guest Player" ? "Guest Indian Player" : "Maharashtra Player"),
      district: p.district,
      state: p.state,
      nationality: p.nationality || "Indian",
      emirates_id: p.emiratesId,
      emirates_id_expiry: p.emiratesIdExpiry || null,
      cricheroes_url: p.cricheroes,
      playing_role: p.role,
      batting_style: p.battingStyle,
      bowling_style: p.bowlingStyle,
      batting_position: p.battingPosition,
      current_team: p.currentTeam,
      previous_teams: p.previousTeams,
      experience: p.experience,
      major_experience: p.majorExperience,
      achievements: p.achievements,
      uae_experience: p.uaeExperience,
      category: p.category || "To Be Reviewed",
      application_status: p.applicationStatus || "New",
      auction_category: p.auctionCategory || null,
      team_id: p.soldTo ? teamIdMap.get(p.soldTo) ?? null : null,
      sold_points: p.soldPoints || null,
      registration_fee_amount: p.registrationFeeAmount ?? 25,
      amount_paid: p.amountPaid ?? 0,
      payment_status: p.paymentStatus ?? "Pending",
      payment_reference: p.paymentReference,
      payment_date: p.paymentDate || null,
      declaration_accepted: p.declarationAccepted ?? true, // legacy records predate the checkbox
      internal_notes: p.notesInternal,
      // photo / emiratesIdCopy / receipt were base64 blobs in the artifact —
      // re-upload these manually per player after import; this script does
      // not decode/re-upload binaries into Storage.
    });

    if (error) console.error(`Failed to import player "${p.fullName}":`, error.message);
    else console.log(`Imported player: ${p.fullName}`);
  }
}

async function main() {
  const teamIdMap = await importTeams();
  await importPlayers(teamIdMap);
  console.log("\nDone. Remember: uploaded files (photos, Emirates IDs, receipts, logos) were base64 blobs in the");
  console.log("artifact prototype and are NOT migrated by this script — re-upload them via the admin UI once");
  console.log("records exist, so they land in the correct Supabase Storage buckets with proper access control.");
}

main();
