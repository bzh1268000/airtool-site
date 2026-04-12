import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

// Service-role key bypasses RLS — required for server-side writes from webhooks.
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature invalid";
    console.error("[stripe-webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── checkout.session.completed ────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session   = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;

    if (!bookingId) {
      console.error("[stripe-webhook] No booking_id in session metadata", session.id);
      return NextResponse.json({ received: true });
    }

    const { error } = await adminSupabase
      .from("bookings")
      .update({
        stripe_session_id: session.id,
        paid_at:           new Date().toISOString(),
        status:            "in_use",
      })
      .eq("id", Number(bookingId))
      .select("id");

    if (error) {
      console.error("[stripe-webhook] Supabase update failed:", error.message);
    }
  }

  return NextResponse.json({ received: true });
}
