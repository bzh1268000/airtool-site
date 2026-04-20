import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    const saleToolId = session.metadata?.sale_tool_id;

    if (bookingId) {
      // Rental payment
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
        console.error("[stripe-webhook] Booking update failed:", error.message);
      }
    } else if (saleToolId) {
      // Tool sale — fetch tool name + commission rate, then mark as sold and record the sale
      const [{ data: toolRow }, { data: commissionSetting }] = await Promise.all([
        adminSupabase.from("tools").select("name").eq("id", Number(saleToolId)).single(),
        adminSupabase.from("platform_settings").select("value").eq("key", "sale_commission_pct").single(),
      ]);

      const salePrice = session.amount_total ? session.amount_total / 100 : 0;
      const commissionPct = commissionSetting?.value ? Number(commissionSetting.value) : 10;
      const platformCommission = Math.round(salePrice * commissionPct) / 100;

      const [{ error: toolErr }, { error: saleErr }] = await Promise.all([
        adminSupabase
          .from("tools")
          .update({ status: "sold" })
          .eq("id", Number(saleToolId)),
        adminSupabase
          .from("tool_sales")
          .insert({
            tool_id:             Number(saleToolId),
            tool_name:           toolRow?.name ?? "Unknown tool",
            sale_price:          salePrice,
            platform_commission: platformCommission,
            buyer_email:         session.metadata?.buyer_email || session.customer_email || "",
            buyer_name:          session.metadata?.buyer_name || "",
            owner_email:         session.metadata?.owner_email || "",
            stripe_session_id:   session.id,
            payout_status:       "pending",
          }),
      ]);

      if (toolErr)  console.error("[stripe-webhook] Tool status update failed:", toolErr.message);
      if (saleErr)  console.error("[stripe-webhook] tool_sales insert failed:", saleErr.message);

      // Award XP to buyer and owner
      const buyerEmail  = session.metadata?.buyer_email || session.customer_email || "";
      const ownerEmail  = session.metadata?.owner_email || "";

      const [{ data: buyerProfile }, { data: ownerProfile }, { data: xpSettings }] = await Promise.all([
        adminSupabase.from("profiles").select("id").eq("email", buyerEmail).single(),
        adminSupabase.from("profiles").select("id").eq("email", ownerEmail).single(),
        adminSupabase.from("platform_settings").select("key, value").like("key", "xp_rule.%"),
      ]);

      const xpMap: Record<string, number> = { tool_purchased: 5, tool_sold: 3 };
      xpSettings?.forEach((s: { key: string; value: string }) => {
        xpMap[s.key.replace("xp_rule.", "")] = parseInt(s.value);
      });

      const xpInserts = [];
      if (buyerProfile) xpInserts.push({
        user_id: buyerProfile.id, role: "renter",
        event_type: "tool_purchased", points: xpMap["tool_purchased"],
        notes: `Bought tool #${saleToolId}`,
      });
      if (ownerProfile) xpInserts.push({
        user_id: ownerProfile.id, role: "owner",
        event_type: "tool_sold", points: xpMap["tool_sold"],
        notes: `Sold tool #${saleToolId}`,
      });

      if (xpInserts.length > 0) {
        const { error: xpErr } = await adminSupabase
          .from("experience_points")
          .upsert(xpInserts, { onConflict: "user_id,event_type,notes", ignoreDuplicates: true });
        if (xpErr) console.error("[stripe-webhook] XP insert failed:", xpErr.message);
      }

      // Send emails — buyer receipt + owner sale notification
      const toolName    = toolRow?.name ?? "Unknown tool";
      const saleDateStr = new Date().toLocaleDateString("en-NZ", { dateStyle: "long" });
      const ref         = `AT-SALE-${session.id.slice(0, 8).toUpperCase()}`;
      const net         = (salePrice - platformCommission).toFixed(2);

      const buyerHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1b1b1b">
          <div style="background:#c2410c;padding:28px 32px;border-radius:16px 16px 0 0">
            <h1 style="margin:0;color:#fff;font-size:22px">🏷️ Purchase Receipt</h1>
          </div>
          <div style="background:#fff;padding:28px 32px;border:1px solid #e5e5e5;border-top:0">
            <p>Hi ${session.metadata?.buyer_name || "there"},</p>
            <p>You've successfully purchased <strong>${toolName}</strong> via AirTool. It's yours to keep!</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
              <tr style="background:#fff7ed">
                <td style="padding:10px 14px;border:1px solid #fed7aa;font-weight:600">Tool</td>
                <td style="padding:10px 14px;border:1px solid #fed7aa">${toolName}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Amount paid</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">NZ$${salePrice.toFixed(2)}</td>
              </tr>
              <tr style="background:#f9fafb">
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Date</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">${saleDateStr}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Reference</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-family:monospace">${ref}</td>
              </tr>
            </table>
            <p style="font-size:14px;color:#555">The owner will be in touch to arrange collection or delivery.</p>
            <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
              View your purchases at <a href="https://airtool.nz/renter" style="color:#c2410c">airtool.nz/renter</a> · Questions? Reply to this email.
            </p>
          </div>
        </div>`;

      const ownerHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1b1b1b">
          <div style="background:#2f641f;padding:28px 32px;border-radius:16px 16px 0 0">
            <h1 style="margin:0;color:#fff;font-size:22px">🎉 Your tool has sold!</h1>
          </div>
          <div style="background:#fff;padding:28px 32px;border:1px solid #e5e5e5;border-top:0">
            <p>Great news — <strong>${toolName}</strong> has been sold on AirTool.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
              <tr style="background:#f8fdf3">
                <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Tool sold</td>
                <td style="padding:10px 14px;border:1px solid #d4e8b0">${toolName}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Sale price</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">NZ$${salePrice.toFixed(2)}</td>
              </tr>
              <tr style="background:#f9fafb">
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Platform fee (${commissionPct}%)</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">− NZ$${platformCommission.toFixed(2)}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:10px 14px;border:1px solid #bbf7d0;font-weight:700;color:#166534">Your payout</td>
                <td style="padding:10px 14px;border:1px solid #bbf7d0;font-weight:700;color:#166534">NZ$${net}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Buyer</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">${session.metadata?.buyer_name || buyerEmail}</td>
              </tr>
              <tr style="background:#f9fafb">
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Date</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">${saleDateStr}</td>
              </tr>
            </table>
            <p style="font-size:14px;color:#555">AirTool admin will process your payout shortly. Make sure your bank details are up to date in your <a href="https://airtool.nz/owner" style="color:#2f641f">owner dashboard</a>.</p>
            <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
              View your sales at <a href="https://airtool.nz/owner" style="color:#2f641f">airtool.nz/owner</a>
            </p>
          </div>
        </div>`;

      await Promise.all([
        buyerEmail ? resend.emails.send({
          from:    "AirTool.nz <onboarding@resend.dev>",
          to:      [buyerEmail],
          subject: `🏷️ Purchase receipt — ${toolName}`,
          html:    buyerHtml,
        }) : Promise.resolve(),
        ownerEmail ? resend.emails.send({
          from:    "AirTool.nz <onboarding@resend.dev>",
          to:      [ownerEmail],
          subject: `🎉 Your tool sold — NZ$${net} payout pending`,
          html:    ownerHtml,
        }) : Promise.resolve(),
      ]);
    } else {
      console.error("[stripe-webhook] No booking_id or sale_tool_id in session metadata", session.id);
    }
  }

  return NextResponse.json({ received: true });
}
