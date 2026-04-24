import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { booking_ids, user_email } = await req.json();
    console.log("[cart-checkout] received booking_ids:", booking_ids, "user_email:", user_email);

    // ── Env diagnostics ───────────────────────────────────────────────────────
    console.log("[cart-checkout] SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log("[cart-checkout] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

    if (!booking_ids?.length) {
      return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 });
    }

    // Fetch bookings — two separate queries, no FK join (bookings↔tools have no FK)
    const { data: bookings, error: bErr } = await adminSupabase
      .from("bookings")
      .select("id, tool_id, price_total, start_date, end_date, preferred_dates, status, paid_at, user_email")
      .in("id", booking_ids);

    console.log("[cart-checkout] bookings query result:", bookings, "error:", bErr);

    if (bErr || !bookings?.length) {
      return NextResponse.json({
        error: `Bookings not found for ids: ${JSON.stringify(booking_ids)}`,
        supabase_error: bErr?.message ?? null,
      }, { status: 404 });
    }

    // Fetch tool names separately
    const toolIds = [...new Set(bookings.map((b: any) => b.tool_id).filter(Boolean))];
    const { data: tools } = await adminSupabase
      .from("tools")
      .select("id, name")
      .in("id", toolIds);
    const toolsMap: Record<number, string> = Object.fromEntries(
      (tools ?? []).map((t: any) => [t.id, t.name])
    );

    // Build line items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = bookings.map((b: any) => {
      const toolName = toolsMap[b.tool_id] || "Tool Rental";
      const dates    = b.preferred_dates || `${b.start_date} → ${b.end_date}`;
      const amount   = Math.round(Number(b.price_total) * 100);

      return {
        price_data: {
          currency: "nzd",
          product_data: {
            name:        `${toolName} rental`,
            description: dates,
          },
          unit_amount: Math.max(amount, 50), // Stripe minimum 50 cents
        },
        quantity: 1,
      };
    });

    const totalCents = line_items.reduce((s, li) => s + ((li.price_data?.unit_amount ?? 0) as number), 0);
    if (totalCents < 50) {
      return NextResponse.json({ error: "Total too low for Stripe (min $0.50)" }, { status: 400 });
    }

    const siteUrl = new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "nzd",
      line_items,
      metadata: {
        booking_ids:   JSON.stringify(booking_ids),
        user_email:    user_email || "",
        checkout_type: "cart",
      },
      customer_email: user_email || undefined,
      success_url: `${siteUrl}/cart/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/cart`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe checkout failed";
    console.error("[cart-checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
