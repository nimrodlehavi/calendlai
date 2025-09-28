import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendBookingEmail({
  to,
  subject,
  text,
  icsContent,
}: {
  to: string;
  subject: string;
  text: string;
  icsContent: string;
}) {
  try {
    const res = await resend.emails.send({
      from: "CalendlAI <no-reply@calendlai.cronussystems.com>", // ✅ verified domain
      to,
      subject,
      html: `<p>${text}</p>`,
      attachments: [
        {
          filename: "invite.ics",
          content: Buffer.from(icsContent).toString("base64"),
          type: "text/calendar",
        },
      ],
    });
    console.log("Resend response:", res);
    return res;
  } catch (err) {
    console.error("Resend error:", err);
    throw err;
  }
}
