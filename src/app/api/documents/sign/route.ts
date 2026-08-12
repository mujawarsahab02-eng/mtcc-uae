import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { DOCUMENT_ACCESS_ROLES } from "@/lib/constants";

const ALLOWED_PRIVATE_BUCKETS = ["emirates-ids", "payment-receipts", "tournament-documents"];

// Item 19: this is the ONLY way to read anything out of the private
// document buckets. It requires a real authenticated session (checked
// against the profiles table, same as everywhere else) — the bucket itself
// also has RLS (see 0004_storage.sql) as a second, independent layer.
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !DOCUMENT_ACCESS_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "Not authorised to access this document." }, { status: 403 });
  }

  const { bucket, path } = await req.json();
  if (!bucket || !path || !ALLOWED_PRIVATE_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket or path." }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from(bucket).createSignedUrl(path, 120); // 2-minute link
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Could not sign URL." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
