"use server";

import { createClient } from "@/lib/supabase/server";

const TYPES = ["Player", "Team owner or captain", "Sponsor or partner", "Volunteer or official", "Spectator or family member", "Other"];
const FORMATS = ["Just right", "Too short", "Too long", "No opinion"];
const SEASON2 = ["Yes, I'll play", "Yes, I'll bring a team", "Yes, I'll come as a spectator", "Interested as a sponsor", "Not sure yet"];

const rating = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};
const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s ? s : null;
};

export async function submitFeedback(input: Record<string, any>): Promise<{ ok?: true; error?: string }> {
  // Honeypot: real people never fill this hidden field.
  if (input.website) return { ok: true };

  const respondent_type = TYPES.includes(input.respondent_type) ? input.respondent_type : null;
  const overall = rating(input.overall);
  if (!respondent_type) return { error: "Please tell us who you are (first question)." };
  if (!overall) return { error: "Please give an overall rating." };

  const supabase = createClient();
  const { data: settings } = await supabase.from("tournament_settings").select("feedback_closes_on").eq("id", 1).single();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  if (settings?.feedback_closes_on && today > settings.feedback_closes_on) {
    return { error: "Feedback is now closed. Thank you!" };
  }

  const { error } = await supabase.from("feedback_responses").insert({
    respondent_type,
    team_name: text(input.team_name, 80),
    overall,
    rating_organisation: rating(input.rating_organisation),
    rating_ground: rating(input.rating_ground),
    rating_food: rating(input.rating_food),
    rating_umpiring: rating(input.rating_umpiring),
    rating_live_scores: rating(input.rating_live_scores),
    format_opinion: FORMATS.includes(input.format_opinion) ? input.format_opinion : null,
    auction_rating: rating(input.auction_rating),
    best_part: text(input.best_part, 1500),
    improve: text(input.improve, 1500),
    season2: SEASON2.includes(input.season2) ? input.season2 : null,
    name: text(input.name, 100),
    phone: text(input.phone, 30),
  });
  if (error) return { error: "Sorry, something went wrong. Please try again." };
  return { ok: true };
}
