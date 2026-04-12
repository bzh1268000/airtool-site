import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userEmail,
      userName,
      toolName,
      status,
      startDate,
      endDate,
    } = body;

    const niceStatus =
      status === "approved" ? "approved" : "rejected";

    const subject =
      status === "approved"
        ? `Your booking is approved: ${toolName}`
        : `Your booking is rejected: ${toolName}`;

    const html =
      status === "approved"
        ? `
          <h2>Your booking is approved</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Your booking for <strong>${toolName}</strong> has been <strong>approved</strong>.</p>
          <p><strong>Start date:</strong> ${startDate || "-"}</p>
          <p><strong>End date:</strong> ${endDate || "-"}</p>
          <p>We will contact you with the next steps.</p>
          <p>Thank you,<br />AirTool</p>
        `
        : `
          <h2>Your booking is rejected</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Your booking for <strong>${toolName}</strong> has been <strong>${niceStatus}</strong>.</p>
          <p><strong>Start date:</strong> ${startDate || "-"}</p>
          <p><strong>End date:</strong> ${endDate || "-"}</p>
          <p>Please contact us if you want to try different dates.</p>
          <p>Thank you,<br />AirTool</p>
        `;

    const { data, error } = await resend.emails.send({
      from: "AirTool <onboarding@resend.dev>",
      to: [userEmail],
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send status email" },
      { status: 500 }
    );
  }
}