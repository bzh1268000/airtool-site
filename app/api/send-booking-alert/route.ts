import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toolName, userName, userEmail, userPhone, startDate, endDate, ownerEmail } = body;

    const recipients = [process.env.ADMIN_EMAIL as string];
    if (ownerEmail && ownerEmail !== process.env.ADMIN_EMAIL) recipients.push(ownerEmail);

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1b1b1b">
        <div style="background:#2f641f;padding:24px 32px;border-radius:16px 16px 0 0">
          <h1 style="margin:0;color:#fff;font-size:20px">📬 New Booking Request</h1>
        </div>
        <div style="background:#fff;padding:24px 32px;border:1px solid #e5e5e5;border-top:0;border-radius:0 0 16px 16px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="background:#f8fdf3">
              <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Tool</td>
              <td style="padding:10px 14px;border:1px solid #d4e8b0">${toolName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Renter</td>
              <td style="padding:10px 14px;border:1px solid #e5e5e5">${userName} (${userEmail})</td>
            </tr>
            <tr style="background:#f8fdf3">
              <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">Phone</td>
              <td style="padding:10px 14px;border:1px solid #d4e8b0">${userPhone}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e5e5;font-weight:600">Start</td>
              <td style="padding:10px 14px;border:1px solid #e5e5e5">${startDate}</td>
            </tr>
            <tr style="background:#f8fdf3">
              <td style="padding:10px 14px;border:1px solid #d4e8b0;font-weight:600">End</td>
              <td style="padding:10px 14px;border:1px solid #d4e8b0">${endDate}</td>
            </tr>
          </table>
          <p style="margin-top:20px;font-size:14px;color:#555">Log in to your dashboard to approve or decline this request.</p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: "AirTool <onboarding@resend.dev>",
      to: recipients,
      subject: `📬 New booking request: ${toolName}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to send email" }, { status: 500 });
  }
}
