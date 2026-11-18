export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "removal@yalepaths.local";

export function mapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  if (!token || token.startsWith("your-")) return null;
  return token;
}
