import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // If no API key, log and return success (for development)
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "⚠️ RESEND_API_KEY not set. Email verification disabled. In development, use this verification link:"
      );
      console.warn(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/api/auth/verify-email?token=${verificationToken}`
      );
      return { success: true };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Verify your email - AI Study Assistant",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">AI Study Assistant</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Hi ${name}!</h2>
              <p>Thank you for signing up for AI Study Assistant. Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
              </div>
              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="color: #667eea; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
              <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} AI Study Assistant. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      // Handle Resend testing limitation: can only send to account owner's email
      // In development, fall back to console logging
      if (
        error.statusCode === 403 &&
        error.message?.includes("You can only send testing emails")
      ) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

        console.warn(
          "⚠️ Resend testing limitation: Can only send to your account email."
        );
        console.warn("📧 For development, use this verification link:");
        console.warn(`🔗 ${verificationUrl}`);
        console.warn(
          "💡 To send to any email, verify a domain at resend.com/domains"
        );

        // Return success so registration doesn't fail
        // User can still verify using the console link
        return { success: true };
      }

      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}
