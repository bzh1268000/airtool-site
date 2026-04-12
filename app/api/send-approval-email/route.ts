import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const {
      renterEmail,
      renterName,
      toolName,
      bookingId,
      preferredDates,
      startDate,
      endDate,
      priceTotal,
    } = await req.json();

    if (!renterEmail || !bookingId) {
      return NextResponse.json({ ok: false, error: "renterEmail and bookingId are required" }, { status: 400 });
    }

    const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || "https://airtool.nz";
    const payUrl   = `${siteUrl}/my-booking/${bookingId}`;
    const window   = preferredDates || `${startDate || "?"} → ${endDate || "?"}`;
    const greeting = renterName ? `Hi ${renterName},` : "Hi there,";
    const price    = priceTotal != null ? `$${Number(priceTotal).toFixed(2)} NZD` : null;

    const { data, error } = await resend.emails.send({
      from:    "AirTool.nz <onboarding@resend.dev>",
      to:      [renterEmail],
      subject: `✅ Booking approved — ${toolName || "your tool rental"}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1b1b1b">
          <div style="background:#2f641f;padding:28px 32px;border-radius:16px 16px 0 0">
            <h1 style="margin:0;color:#fff;font-size:22px">Your booking is approved!</h1>
          </div>
          <div style="background:#fff;padding:28px 32px;border:1px solid #e5e5e5;border-top:0">
            <p>${greeting}</p>
            <p>Great news — the owner has approved your booking for
              <strong>${toolName || "the tool"}</strong>.</p>

            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
              <tr style="background:#f8fdf3">
                <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Rental window</td>
                <td style="padding:10px 14px;border:1px solid #d4e8b0">${window}</td>
              </tr>
              ${price ? `
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Total (incl. platform fee)</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">${price}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Booking #</td>
                <td style="padding:10px 14px;border:1px solid #e5e5e5">${bookingId}</td>
              </tr>
            </table>

            <p style="font-size:14px;color:#555">
              Click the button below to confirm and pay securely via Stripe.
              Your payment is held in escrow and released to the owner only after the tool is safely returned.
            </p>

            <div style="text-align:center;margin:28px 0">
              <a href="${payUrl}"
                style="display:inline-block;background:#8bbb46;color:#fff;font-weight:700;
                       font-size:16px;padding:14px 36px;border-radius:50px;text-decoration:none">
                💳 Confirm &amp; Pay Now →
              </a>
            </div>

            <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
              If you no longer want this rental, you can cancel from your
              <a href="${siteUrl}/renter" style="color:#2f641f">dashboard</a>.
              Questions? Reply to this email or message the owner directly.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send approval email";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
