import { promises as dns } from "dns";

/**
 * List of known disposable/temporary email domains
 * You can expand this list or use an API service
 */
const DISPOSABLE_EMAIL_DOMAINS = [
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "mailinator.com",
  "throwaway.email",
  "temp-mail.org",
  "getnada.com",
  "mohmal.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "maildrop.cc",
  "mintemail.com",
  "fakeinbox.com",
  "dispostable.com",
];

/**
 * Validate email format using regex
 */
export function validateEmailFormat(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Check if email domain is disposable/temporary
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Check if email domain has MX records (has email servers)
 * This verifies the domain can actually receive emails
 */
export async function hasValidMXRecord(email: string): Promise<boolean> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;

    // Check for MX records
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords.length > 0;
  } catch (error) {
    // If DNS lookup fails, domain likely doesn't exist or has no email servers
    return false;
  }
}

/**
 * Comprehensive email validation
 * Returns validation result with reason if invalid
 */
export async function validateEmail(
  email: string
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Format validation
  if (!validateEmailFormat(email)) {
    return { valid: false, reason: "Invalid email format" };
  }

  // 2. Disposable email check
  if (isDisposableEmail(email)) {
    return {
      valid: false,
      reason: "Disposable/temporary email addresses are not allowed",
    };
  }

  // 3. MX record validation (async, can be slow)
  // Enabled by default to block fake/random email domains
  // Set ENABLE_MX_VALIDATION=false to disable
  const enableMXValidation = process.env.ENABLE_MX_VALIDATION !== "false";

  if (enableMXValidation) {
    try {
      const hasMX = await hasValidMXRecord(email);
      if (!hasMX) {
        return {
          valid: false,
          reason:
            "Email domain does not have valid mail servers. Please use a valid email address.",
        };
      }
    } catch (error) {
      // If DNS lookup fails, treat as invalid domain
      return {
        valid: false,
        reason:
          "Email domain does not have valid mail servers. Please use a valid email address.",
      };
    }
  }

  return { valid: true };
}
