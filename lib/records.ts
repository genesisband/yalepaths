import type { Experience, ExperienceProfile, ExperienceType, Profile } from "@/lib/types";

export const EXPERIENCE_SELECT = `
  id, owner_id, role, organization, experience_type, city, region, lat, lng,
  lab_name, note, start_year, start_month, end_year, end_month, ongoing, shared,
  profiles (display_name, class_year)
`;

function asProfile(value: unknown): ExperienceProfile | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const record = row as { display_name?: string | null; class_year?: number | null };
  if (!record.display_name) return null;
  return { display_name: record.display_name, class_year: record.class_year ?? null };
}

export function normalizeExperience(row: Record<string, unknown>): Experience {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    role: String(row.role),
    organization: String(row.organization),
    experience_type: String(row.experience_type) as ExperienceType,
    city: String(row.city),
    region: String(row.region ?? ""),
    lat: Number(row.lat),
    lng: Number(row.lng),
    lab_name: row.lab_name ? String(row.lab_name) : null,
    note: row.note ? String(row.note) : null,
    start_year: Number(row.start_year),
    start_month: Number(row.start_month),
    end_year: row.end_year == null ? null : Number(row.end_year),
    end_month: row.end_month == null ? null : Number(row.end_month),
    ongoing: Boolean(row.ongoing),
    shared: Boolean(row.shared),
    profile: asProfile(row.profiles),
  };
}

export function normalizeProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    display_name: row.display_name ? String(row.display_name) : null,
    class_year: row.class_year == null ? null : Number(row.class_year),
    linkedin_url: row.linkedin_url ? String(row.linkedin_url) : null,
    show_linkedin: Boolean(row.show_linkedin),
    phone: row.phone ? String(row.phone) : null,
    show_phone: Boolean(row.show_phone),
    contact_email: row.contact_email ? String(row.contact_email) : null,
    show_contact_email: Boolean(row.show_contact_email),
    yale_email_verified: Boolean(row.yale_email_verified),
    cas_verified: row.cas_verified === true,
  };
}
