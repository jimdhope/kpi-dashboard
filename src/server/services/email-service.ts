import nodemailer from "nodemailer";

const smtpHost = () => process.env.SMTP_HOST;
const smtpPort = () => parseInt(process.env.SMTP_PORT ?? "1025", 10);
const smtpUser = () => process.env.SMTP_USER ?? "";
const smtpPass = () => process.env.SMTP_PASS ?? "";
const smtpFrom = () => process.env.SMTP_FROM ?? "noreply@kpi-quest.local";

function createTransport() {
  return nodemailer.createTransport({
    host: smtpHost(),
    port: smtpPort(),
    auth:
      smtpUser() && smtpPass()
        ? { user: smtpUser(), pass: smtpPass() }
        : undefined,
    secure: false,
  });
}

export const emailService = {
  async sendPasswordResetEmail(email: string, resetUrl: string) {
    const transporter = createTransport();

    await transporter.sendMail({
      from: smtpFrom(),
      to: email,
      subject: "Reset your KPI Quest password",
      text: `You requested a password reset. Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
    });
  },
};
