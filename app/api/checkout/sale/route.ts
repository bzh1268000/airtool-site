import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

function anonSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { toolId, buyerEmail, buyerName } = await req.json();

    if (!toolId) {
      return NextResponse.json({ error: "toolId is required" }, { status: 400 });
    }

    const supabase = anonSupabase();

    const { data: tool, error: tErr } = await supabase
      .from("tools")
      .select("id, name, sale_price, price_per_day, promo_price, promo_label, status, owner_email")
      .eq("id", Number(toolId))
      .single();

    if (tErr || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (tool.status !== "for_sale") {
      return NextResponse.json({ error: "Tool is not listed for sale" }, { status: 400 });
    }

    if (!tool.sale_price || Number(tool.sale_price) <= 0) {
      return NextResponse.json({ error: "Tool has no valid sale price" }, { status: 400 });
    }

    const effectivePrice = tool.promo_price ? Number(tool.promo_price) : Number(tool.sale_price);
    const amountCents = Math.round(effectivePrice * 100);

    if (amountCents < 50) {
      return NextResponse.json({ error: "Sale price too low (min $0.50)" }, { status: 400 });
    }

    const siteUrl = new URL(req.url).origin;

    const description = tool.promo_price
      ? `${tool.promo_label || "PROMO"} — was NZ$${Number(tool.sale_price).toFixed(2)}`
      : `Purchase price — own it outright`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "nzd",
      line_items: [
        {
          price_data: {
            currency: "nzd",
            product_data: {
              name: `Buy: ${tool.name}`,
              description,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        sale_tool_id: String(tool.id),
        buyer_email: buyerEmail || "",
        buyer_name: buyerName || "",
        owner_email: tool.owner_email || "",
      },
      customer_email: buyerEmail || undefined,
      success_url: `${siteUrl}/tools/${tool.id}?sale=success`,
      cancel_url: `${siteUrl}/tools/${tool.id}?sale=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe checkout failed";
    console.error("[checkout/sale]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
