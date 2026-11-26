"use server";

import { createClient } from "@/lib/supabase/server";

const INTERESTS = ["Play as a player", "Bring a team", "Team owner", "Sponsor or partner", "Volunteer", "Spectator", "Other"];
const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s ? s : null;
};

export async function registerSeason2Interest(input: Record<string, any>): Promise<{ ok?: true; error?: string }> {
  if (input.website) return { ok: true }; // honeypot
  const name = text(input.name, 100);
  const phone = text(input.phone, 30);
  const interest = INTERESTS.includes(input.interest) ? input.interest : null;
  if (!name) return { error: "Please enter your name." };
  if (!phone || phone.replace(/\D/g, "").length < 7) return { error: "Please enter a phone number we can reach you on." };
  if (!interest) return { error: "Please choose how you would like to be part of Season 2." };
  const supabase = createClient();
  const { error } = await (supabase as any).from("season2_interest").insert({
    name, phone, interest, organisation: text(input.organisation, 120), message: text(input.message, 1000),
  });
  if (error) return { error: "Sorry, something went wrong. Please try again." };
  return { ok: true };
}
