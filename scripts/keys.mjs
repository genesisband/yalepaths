import crypto from "node:crypto";

export const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

export function signRole(role) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      iss: "supabase-demo",
      role,
      iat: now,
      exp: now + 60 * 60 * 24 * 365 * 5,
    }),
  ).toString("base64url");
  const data = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}
