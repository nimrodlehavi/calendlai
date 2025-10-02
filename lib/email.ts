import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM || process.env.EMAIL_FROM || "CalendlAI <no-reply@calendlai.cronussystems.com>";

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
    const attachments = icsContent ? [
      {
        filename: "invite.ics",
        content: Buffer.from(icsContent).toString("base64"),
        contentType: "text/calendar",
      },
    ] : undefined;
    const res = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
      attachments,
    });
    console.log("Resend response:", res);
    return res;
  } catch (err) {
    console.error("Resend error:", err);
    throw err;
  }
}
