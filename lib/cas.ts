/** Yale CAS 2.0. The browser signs in on Yale's site. This server only checks the one-time ticket. */

export const CAS_BASE = "https://secure.its.yale.edu/cas";

const NETID = /^[a-z][a-z0-9]{1,15}$/;
const TICKET = /^ST-[A-Za-z0-9._-]{8,256}$/;

export function configuredOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isLocalHost(host: string | null | undefined): boolean {
  return Boolean(host && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host));
}

/** Prefer the configured public origin. Otherwise allow only a local host. */
export function originFromHost(host: string | null, proto: string | null): string | null {
  const configured = configuredOrigin();
  if (configured) return configured;
  if (!isLocalHost(host)) return null;
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

export function originForRequest(requestUrl: string): string {
  return configuredOrigin() ?? new URL(requestUrl).origin;
}

export function casCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/cas/callback`;
}

export function casLoginUrl(origin: string): string {
  return `${CAS_BASE}/login?service=${encodeURIComponent(casCallbackUrl(origin))}`;
}

export function casLogoutUrl(returnTo: string | null): string {
  if (!returnTo) return `${CAS_BASE}/logout`;
  return `${CAS_BASE}/logout?service=${encodeURIComponent(returnTo)}`;
}

/** CAS returns a NetID. Yale delivers mail at netid@yale.edu. */
export function netidToYaleEmail(netid: string): string | null {
  const id = netid.trim().toLowerCase();
  if (!NETID.test(id)) return null;
  return `${id}@yale.edu`;
}

export function parseCasNetid(xml: string): string | null {
  const body = xml.replace(/^\uFEFF/, "");
  if (/<(?:\w+:)?authenticationFailure[\s>]/i.test(body)) return null;
  const match = body.match(/<(?:\w+:)?authenticationSuccess\b[^>]*>[\s\S]*?<(?:\w+:)?user>\s*([^<\s]+)\s*<\/(?:\w+:)?user>/i);
  if (!match?.[1]) return null;
  return match[1];
}

export async function validateCasTicket(ticket: string, service: string): Promise<string | null> {
  if (!TICKET.test(ticket)) return null;
  const url = new URL(`${CAS_BASE}/serviceValidate`);
  url.searchParams.set("service", service);
  url.searchParams.set("ticket", ticket);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const netid = parseCasNetid(await response.text());
  if (!netid) return null;
  return netidToYaleEmail(netid);
}
