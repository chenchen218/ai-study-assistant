import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * Creates an AWS SES v2 client using environment variables
 * Uses the same AWS credentials as S3
 * @returns Configured SES client
 */
function createSESClient() {
  return new SESv2Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

/**
 * Sends an email using AWS SES
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - HTML email body
 * @param textBody - Plain text email body (optional)
 * @returns Promise resolving to message ID
 * @throws {Error} If email sending fails
 */
export async function sendEmailViaSES(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<string> {
  try {
    const sesClient = createSESClient();
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_FROM || "noreply@aistudyassistant.com";

    const command = new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: "UTF-8",
            },
            ...(textBody && {
              Text: {
                Data: textBody,
                Charset: "UTF-8",
              },
            }),
          },
        },
      },
    });

    const response = await sesClient.send(command);
    console.log("✅ Email sent via AWS SES:", response.MessageId);
    return response.MessageId || "";
  } catch (error: any) {
    console.error("❌ Error sending email via AWS SES:", error);
    throw new Error(`Failed to send email via SES: ${error.message}`);
  }
}

