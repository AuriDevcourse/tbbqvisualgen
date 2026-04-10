import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { message } = await req.json();

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.FEEDBACK_EMAIL || "baciauskas.aurimas@gmail.com";

  if (!apiKey) {
    console.error("Missing RESEND_API_KEY");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "TechBBQ Visual Generator <onboarding@resend.dev>",
        to: toEmail,
        subject: "Visual Generator Feedback",
        text: `New feedback from TechBBQ Visual Generator:\n\n${message.trim()}\n\n---\nSent at ${new Date().toISOString()}`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback send error:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
