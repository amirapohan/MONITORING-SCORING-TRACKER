import nodemailer from "nodemailer";

// Credentials come from env. If unset, run in log-only mode so the service
// boots and integrates without sending real email (and without shipping
// secrets in source).
const GMAIL_USER = process.env.GMAIL_USER || process.env.SMTP_USER || "";
const GMAIL_PASS = process.env.GMAIL_PASS || process.env.SMTP_PASS || "";
const MAIL_FROM =
  process.env.MAIL_FROM || `ProjectHub <${GMAIL_USER || "no-reply@localhost"}>`;
const emailEnabled = Boolean(GMAIL_USER && GMAIL_PASS);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
  : null;

export async function sendEmail(event) {
  const subject =
    event.status === "ACCEPTED"
      ? "Bidding Accepted"
      : "Bidding Rejected";

  const text = `
Halo,

Status bidding kamu: ${event.status}
Project ID: ${event.project_id}

Terima kasih.
`;

  if (!emailEnabled) {
    console.log(
      `[email:log-only] to=${event.email} subject="${subject}" (set GMAIL_USER/GMAIL_PASS to send for real)`,
    );
    return "SKIPPED";
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: event.email,
      subject,
      text,
    });

    console.log("Email berhasil dikirim");
    return "SUCCESS";
  } catch (error) {
    console.error("Gagal kirim email:", error);
    return "FAILED";
  }
}