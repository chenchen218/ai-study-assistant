import nodemailer from "nodemailer";
import { sendEmailViaSES } from "./ses";

/**
 * Email sending method type
 */
type EmailMethod = "aws-ses" | "gmail" | "smtp";

/**
 * Determines which email method to use based on environment variables
 * Priority: AWS SES (production) > Gmail (development) > Custom SMTP
 * @returns Email method to use
 */
function getEmailMethod(): EmailMethod {
  // Priority 1: AWS SES (best for production - supports all email providers)
  if (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  ) {
    return "aws-ses";
  }

  // Priority 2: Gmail (simplest for development)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return "gmail";
  }

  // Priority 3: Custom SMTP
  if (
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD
  ) {
    return "smtp";
  }

  throw new Error(
    "❌ Email configuration missing!\n\n" +
    "For PRODUCTION (recommended):\n" +
    "AWS_ACCESS_KEY_ID=your-aws-key\n" +
    "AWS_SECRET_ACCESS_KEY=your-aws-secret\n" +
    "AWS_REGION=us-east-1\n" +
    "AWS_SES_FROM_EMAIL=noreply@yourdomain.com\n\n" +
    "For DEVELOPMENT:\n" +
    "GMAIL_USER=your-email@gmail.com\n" +
    "GMAIL_APP_PASSWORD=your-app-password\n\n" +
    "Or use custom SMTP:\n" +
    "EMAIL_HOST=smtp.example.com\n" +
    "EMAIL_PORT=587\n" +
    "EMAIL_USER=your-email@example.com\n" +
    "EMAIL_PASSWORD=your-password\n\n" +
    "See EMAIL_SETUP.md for detailed instructions."
  );
}

/**
 * Creates a nodemailer transporter for SMTP-based email sending
 * @returns Configured nodemailer transporter
 */
function createSMTPTransporter() {
  // Gmail configuration
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailAppPassword) {
    console.log("📧 Using Gmail configuration");
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
  }

  // Custom SMTP configuration
  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (emailHost && emailUser && emailPassword) {
    console.log("📧 Using custom SMTP configuration");
    return nodemailer.createTransport({
      host: emailHost,
      port: parseInt(emailPort || "587"),
      secure: emailPort === "465",
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  throw new Error("SMTP configuration not found");
}

/**
 * Email templates
 */
const verificationEmailHTML = (code: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #7c3aed;">Email Verification</h2>
    <p>Thank you for registering with AI Study Assistant!</p>
    <p>Your verification code is:</p>
    <div style="background-color: #f3f4f6; border: 2px solid #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
      <h1 style="color: #7c3aed; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h1>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
    <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
  </div>
`;

const verificationEmailText = (code: string) => `
  Email Verification
  
  Thank you for registering with AI Study Assistant!
  
  Your verification code is: ${code}
  
  This code will expire in 10 minutes.
  
  If you didn't request this code, please ignore this email.
`;

/**
 * Sends a verification code email to the user
 * Automatically uses AWS SES in production, Gmail/SMTP in development
 * @param email - Recipient email address
 * @param code - 6-digit verification code
 * @returns Promise resolving when email is sent
 * @throws {Error} If email sending fails
 */
export async function sendVerificationCode(
  email: string,
  code: string
): Promise<void> {
  try {
    const method = getEmailMethod();
    const subject = "Email Verification Code - AI Study Assistant";
    const htmlBody = verificationEmailHTML(code);
    const textBody = verificationEmailText(code);

    if (method === "aws-ses") {
      // Use AWS SES (production - supports all email providers)
      console.log("📧 Sending via AWS SES");
      await sendEmailViaSES(email, subject, htmlBody, textBody);
    } else {
      // Use SMTP (Gmail or custom SMTP)
      console.log(`📧 Sending via ${method.toUpperCase()}`);
      const transporter = createSMTPTransporter();
      const emailFrom =
        process.env.EMAIL_FROM ||
        process.env.GMAIL_USER ||
        process.env.EMAIL_USER ||
        "noreply@aistudyassistant.com";

      const mailOptions = {
        from: `"AI Study Assistant" <${emailFrom}>`,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Verification email sent:", info.messageId);
    }
  } catch (error: any) {
    console.error("❌ Error sending verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * Sends an email change notification
 * @param oldEmail - Previous email address
 * @param newEmail - New email address
 * @returns Promise resolving when email is sent
 */
export async function sendEmailChangeNotification(
  oldEmail: string,
  newEmail: string
): Promise<void> {
  try {
    const method = getEmailMethod();
    const subject = "Email Address Changed - AI Study Assistant";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed;">Email Address Changed</h2>
        <p>Your email address has been successfully changed.</p>
        <p><strong>Old email:</strong> ${oldEmail}</p>
        <p><strong>New email:</strong> ${newEmail}</p>
        <p style="color: #dc2626; font-weight: bold;">If you didn't make this change, please contact us immediately.</p>
      </div>
    `;

    if (method === "aws-ses") {
      await sendEmailViaSES(oldEmail, subject, htmlBody);
    } else {
      const transporter = createSMTPTransporter();
      const emailFrom =
        process.env.EMAIL_FROM ||
        process.env.GMAIL_USER ||
        process.env.EMAIL_USER ||
        "noreply@aistudyassistant.com";

      await transporter.sendMail({
        from: `"AI Study Assistant" <${emailFrom}>`,
        to: oldEmail,
        subject,
        html: htmlBody,
      });
    }

    console.log("✅ Email change notification sent to:", oldEmail);
  } catch (error: any) {
    console.error("❌ Error sending email change notification:", error);
    // Don't throw - this is a notification, not critical
  }
}

