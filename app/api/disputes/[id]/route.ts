import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// PATCH /api/disputes/[id] — renter submits their response
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const disputeId = Number(id);

  if (isNaN(disputeId)) {
    return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
  }

  const body = await req.json();
  const { renter_response, renter_evidence_urls } = body;

  if (!renter_response?.trim()) {
    return NextResponse.json({ error: "renter_response is required" }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("disputes")
    .update({
      renter_response:      renter_response.trim(),
      renter_evidence_urls: renter_evidence_urls ?? [],
      renter_responded_at:  new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (error) {
    console.error("[disputes/patch]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
