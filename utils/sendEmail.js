import nodemailer from "nodemailer";

const sendEmail = async (options) => {
  const fromEmail = `${process.env.FROM_NAME || "Resume Builder"} <${
    process.env.FROM_EMAIL || process.env.EMAIL_USER || "onboarding@resend.dev"
  }>`;

  // 1) Try RESEND via direct HTTP (avoids library/version issues)
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: Array.isArray(options.email) ? options.email : [options.email],
          subject: options.subject,
          html: options.html,
          text: options.message,
        }),
      });
      if (resp.ok) {
        return;
      }
      let errText = "";
      try {
        errText = await resp.text();
      } catch {}
      console.error("Resend HTTP failed:", resp.status, errText);
      // If 401/403 or other errors, fall through to SMTP fallback
    } catch (err) {
      console.error("Resend HTTP error:", err?.message || err);
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
    connectionTimeout: 7000,
    greetingTimeout: 7000,
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
