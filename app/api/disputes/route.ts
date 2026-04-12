import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client bypasses RLS — needed for writing disputes from the API.
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/disputes — raise a dispute for a booking
export async function POST(req: NextRequest) {
  try {
    const { bookingId, ownerEmail, renterEmail, reason, amountClaimed, ownerEvidenceUrls } = await req.json();

    if (!bookingId || !reason?.trim()) {
      return NextResponse.json({ error: "bookingId and reason are required" }, { status: 400 });
    }

    // Insert dispute record
    const { error: insertErr } = await adminSupabase.from("disputes").insert({
      booking_id:          Number(bookingId),
      owner_email:         ownerEmail ?? null,
      renter_email:        renterEmail ?? null,
      reason:              reason.trim(),
      amount_claimed:      amountClaimed ?? null,
      owner_evidence_urls: ownerEvidenceUrls ?? [],
      status:              "open",
    });

    if (insertErr) {
      console.error("[disputes] insert failed:", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Update booking status to "disputed"
    const { error: updateErr } = await adminSupabase
      .from("bookings")
      .update({ status: "disputed" })
      .eq("id", Number(bookingId));

    if (updateErr) {
      console.error("[disputes] booking update failed:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[disputes]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/disputes — list all disputes (admin use)
export async function GET() {
  const { data, error } = await adminSupabase
    .from("disputes")
    .select("*, bookings(id, tool_id, price_total, preferred_dates)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disputes: data });
}
