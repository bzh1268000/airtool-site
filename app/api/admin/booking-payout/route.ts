import { createServerClient, type CookieOptions } from "@supabase/auth-helpers-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: "", ...options }); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId, payoutAmount, payoutBankAccount, payoutNote } = await request.json();

  // Fetch booking details for email
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("owner_email, tool_id, price_total, platform_fee")
    .eq("id", bookingId)
    .single();

  const { error } = await supabaseAdmin.from("bookings").update({
    payout_status:       "paid",
    payout_amount:       payoutAmount,
    payout_bank_account: payoutBankAccount || null,
    payout_date:         new Date().toISOString(),
    payout_note:         payoutNote || null,
  }).eq("id", bookingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email owner payout confirmation
  if (booking?.owner_email) {
    const toolName = booking.tool_id ? `Booking #${bookingId}` : `Booking #${bookingId}`;
    resend.emails.send({
      from: "AirTool <onboarding@resend.dev>",
      to: [booking.owner_email],
      subject: `💰 Rental payout transferred — ${toolName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1b1b1b">
          <div style="background:#2f641f;padding:24px 32px;border-radius:16px 16px 0 0">
            <h1 style="margin:0;color:#fff;font-size:20px">💰 Your rental payout has been sent</h1>
          </div>
          <div style="background:#fff;padding:24px 32px;border:1px solid #e5e5e5;border-top:0;border-radius:0 0 16px 16px">
            <p>Hi,</p>
            <p>AirTool has transferred your rental payout for <strong>${toolName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0">
              <tr style="background:#f8fdf3">
                <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Amount transferred</td>
                <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:700;color:#2f641f">$${Number(payoutAmount).toFixed(2)} NZD</td>
              </tr>
              ${payoutBankAccount ? `<tr><td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">To account</td><td style="padding:10px 14px;border:1px solid #e5e5e5">${payoutBankAccount}</td></tr>` : ""}
              ${payoutNote ? `<tr style="background:#f8fdf3"><td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Reference</td><td style="padding:10px 14px;border:1px solid #d4e8b0">${payoutNote}</td></tr>` : ""}
              <tr><td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Date</td><td style="padding:10px 14px;border:1px solid #e5e5e5">${new Date().toLocaleDateString("en-NZ", { dateStyle: "long" })}</td></tr>
            </table>
            <p style="font-size:13px;color:#777">Please allow 1-2 business days for the funds to appear. Contact us if you have any questions.</p>
            <p style="font-size:13px;color:#777">Thank you,<br/>AirTool Team</p>
          </div>
        </div>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
