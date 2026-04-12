import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { toolName, userName, userEmail, userPhone, startDate, endDate } = body;

    const { data, error } = await resend.emails.send({
      from: "AirTool <onboarding@resend.dev>",
      to: [process.env.ADMIN_EMAIL as string],
      subject: `New booking request: ${toolName}`,
      html: `
        <h2>New booking request</h2>
        <p><strong>Tool:</strong> ${toolName}</p>
        <p><strong>Name:</strong> ${userName}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Phone:</strong> ${userPhone}</p>
        <p><strong>Start date:</strong> ${startDate}</p>
        <p><strong>End date:</strong> ${endDate}</p>
        <p>Please attend this request.</p>
      `,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}