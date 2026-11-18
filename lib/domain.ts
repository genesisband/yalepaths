/** Exact yale.edu domain. Subdomains and lookalike hosts are not eligible. */
export function isYaleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return /^[^@\s]+@yale\.edu$/.test(normalized);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
