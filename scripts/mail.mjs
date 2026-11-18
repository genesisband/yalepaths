import fs from "node:fs";
import path from "node:path";

export function mailPath(email) {
  const safe = email.toLowerCase().replace(/[^a-z0-9]+/gi, "_");
  return path.join(".stack", "mail", `${safe}.txt`);
}

export function clearMail(email) {
  fs.rmSync(mailPath(email), { force: true });
}

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export async function waitForCode(email) {
  const file = mailPath(email);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (fs.existsSync(file)) {
      const code = decodeQuotedPrintable(fs.readFileSync(file, "utf8")).match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in code arrived for ${email}`);
}
