import nodemailer from "nodemailer";
import { Resend } from "resend";

const sendEmail = async (options) => {
  const fromEmail = `${process.env.FROM_NAME || "Resume Builder"} <${
    process.env.FROM_EMAIL || process.env.EMAIL_USER || "onboarding@resend.dev"
  }>`;

  // 1) Try RESEND (HTTP API, no SMTP ports)
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: fromEmail,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.message,
      });
      return;
    } catch (err) {
      // fall through to SMTP
      console.error("Resend failed, falling back to SMTP:", err?.message || err);
    }
  }

  // 2) Fallback to Nodemailer SMTP (Gmail or custom SMTP)
  const isGmail =
    (process.env.EMAIL_SERVICE || "").toLowerCase() === "gmail" ||
    (process.env.EMAIL_HOST || "").includes("gmail") ||
    (process.env.EMAIL_USER || "").includes("@gmail.com");

  const transporter = nodemailer.createTransport({
    host: isGmail ? "smtp.gmail.com" : process.env.EMAIL_HOST,
    port: isGmail ? 465 : Number(process.env.EMAIL_PORT || 587),
    secure: isGmail ? true : Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  const message = {
    from: fromEmail,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(message);
};

export default sendEmail;
