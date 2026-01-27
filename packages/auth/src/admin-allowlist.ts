/**
 * Admin allowlist based on Twitter IDs/subjects and emails.
 * These can be configured via environment variables.
 * 
 * Environment Variables:
 * - ADMIN_TWITTER_IDS: Comma-separated list of Twitter subject IDs
 * - ADMIN_EMAILS: Comma-separated list of email addresses
 */

function getAdminTwitterIds(): Set<string> {
  const envIds = process.env.ADMIN_TWITTER_IDS || "";
  const ids = envIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(ids);
}

function getAdminEmails(): Set<string> {
  const envEmails = process.env.ADMIN_EMAILS || "";
  const emails = envEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

export function isAdminTwitterId(twitterSubject: string): boolean {
  const allowlist = getAdminTwitterIds();
  return allowlist.has(twitterSubject);
}

export function isAdminEmail(email: string): boolean {
  const allowlist = getAdminEmails();
  return allowlist.has(email.toLowerCase());
}

export function isAdmin(twitterSubject?: string | null, email?: string | null): boolean {
  if (twitterSubject && isAdminTwitterId(twitterSubject)) {
    return true;
  }
  if (email && isAdminEmail(email)) {
    return true;
  }
  return false;
}

export function getAdminAllowlist(): { twitterIds: string[]; emails: string[] } {
  return {
    twitterIds: Array.from(getAdminTwitterIds()),
    emails: Array.from(getAdminEmails()),
  };
}
