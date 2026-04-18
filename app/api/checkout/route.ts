import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();
    console.log("[checkout] bookingId received:", bookingId);

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const supabase = adminSupabase();

    // Fetch booking
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", Number(bookingId))
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Guard — only confirmed, unpaid bookings may proceed
    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: `Booking must be confirmed before payment (current: ${booking.status})` },
        { status: 400 },
      );
    }
    if (booking.paid_at) {
      return NextResponse.json({ error: "Booking is already paid" }, { status: 400 });
    }

    // Fetch tool name
    const { data: tool } = await supabase
      .from("tools")
      .select("name")
      .eq("id", Number(booking.tool_id))
      .single();

    const toolName = tool?.name || "Tool Rental";
    const amountCents = Math.round(Number(booking.price_total) * 100);

    if (amountCents < 50) {
      return NextResponse.json({ error: "Amount too low for Stripe (min $0.50)" }, { status: 400 });
    }

    // Human-readable rental window
    const rentalWindow = booking.preferred_dates
      || `${booking.start_date} → ${booking.end_date}`;

    const siteUrl = new URL(req.url).origin;

    console.log("[checkout] creating session with metadata booking_id:", String(booking.id));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "nzd",
      line_items: [
        {
          price_data: {
            currency: "nzd",
            product_data: {
              name: `Tool Rental: ${toolName}`,
              description: `${rentalWindow} · Booking #${booking.id}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id: String(booking.id),
      },
      customer_email: booking.user_email ?? undefined,
      success_url: `${siteUrl}/my-booking/${booking.id}?payment=success`,
      cancel_url:  `${siteUrl}/my-booking/${booking.id}?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe checkout failed";
    console.error("[checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
