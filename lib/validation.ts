import { isExperienceType, type ExperienceInput, type ExperienceType } from "@/lib/types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseMonthField(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return { year, month };
}

export function parseDisplayName(raw: string): Parsed<string> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Add the name members should see." };
  if (name.length > 80) return { ok: false, error: "Use a name of 80 characters or fewer." };
  if (/[\u0000-\u001F]/.test(name)) return { ok: false, error: "That name contains unsupported characters." };
  return { ok: true, value: name };
}

export function parseClassYear(raw: string): Parsed<number | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!/^\d{4}$/.test(value)) return { ok: false, error: "Class year should be a four-digit year." };
  const year = Number(value);
  if (year < 1900 || year > 2100) return { ok: false, error: "Class year should be between 1900 and 2100." };
  return { ok: true, value: year };
}

export function parseLinkedIn(raw: string): Parsed<string | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "LinkedIn links should look like https://www.linkedin.com/in/…" };
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "linkedin.com" && host !== "www.linkedin.com")) {
    return { ok: false, error: "Use an https link on linkedin.com." };
  }
  if (url.toString().length > 300) return { ok: false, error: "That LinkedIn link is too long." };
  return { ok: true, value: url.toString() };
}

export function parsePhone(raw: string): Parsed<string | null> {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (!/^[0-9+().\-\s]{7,20}$/.test(value)) return { ok: false, error: "Use a phone number like +1 203 555 0142." };
  return { ok: true, value };
}

export function parseContactEmail(raw: string): Parsed<string | null> {
  const value = raw.trim().toLowerCase();
  if (!value) return { ok: true, value: null };
  if (value.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    return { ok: false, error: "That contact email does not look valid." };
  }
  return { ok: true, value };
}

export function parseOnboardingForm(formData: FormData): Parsed<{ display_name: string; class_year: number | null }> {
  const name = parseDisplayName(text(formData, "display_name"));
  if (!name.ok) return name;
  const classYear = parseClassYear(text(formData, "class_year"));
  if (!classYear.ok) return classYear;
  return { ok: true, value: { display_name: name.value, class_year: classYear.value } };
}

export function parseProfileForm(formData: FormData): Parsed<{
  display_name: string;
  class_year: number | null;
  linkedin_url: string | null;
  show_linkedin: boolean;
  phone: string | null;
  show_phone: boolean;
  contact_email: string | null;
  show_contact_email: boolean;
}> {
  const base = parseOnboardingForm(formData);
  if (!base.ok) return base;
  const linkedin = parseLinkedIn(text(formData, "linkedin_url"));
  if (!linkedin.ok) return linkedin;
  const phone = parsePhone(text(formData, "phone"));
  if (!phone.ok) return phone;
  const contactEmail = parseContactEmail(text(formData, "contact_email"));
  if (!contactEmail.ok) return contactEmail;
  return {
    ok: true,
    value: {
      ...base.value,
      linkedin_url: linkedin.value,
      show_linkedin: formData.get("show_linkedin") === "on" && Boolean(linkedin.value),
      phone: phone.value,
      show_phone: formData.get("show_phone") === "on" && Boolean(phone.value),
      contact_email: contactEmail.value,
      show_contact_email: formData.get("show_contact_email") === "on" && Boolean(contactEmail.value),
    },
  };
}

export function parseExperienceForm(formData: FormData): Parsed<ExperienceInput> {
  const role = text(formData, "role").replace(/\s+/g, " ");
  const organization = text(formData, "organization").replace(/\s+/g, " ");
  const type = text(formData, "experience_type");
  const city = text(formData, "city");
  const region = text(formData, "region");
  const lab = text(formData, "lab_name");
  const note = text(formData, "note");
  const ongoing = formData.get("ongoing") === "on";
  const shared = formData.get("shared") === "on";
  const lat = Number(text(formData, "lat"));
  const lng = Number(text(formData, "lng"));
  const start = parseMonthField(text(formData, "start"));
  const end = parseMonthField(text(formData, "end"));

  if (!role || role.length > 120) return { ok: false, error: "Add a role of 120 characters or fewer." };
  if (!organization || organization.length > 160) return { ok: false, error: "Add an organization of 160 characters or fewer." };
  if (!isExperienceType(type)) return { ok: false, error: "Choose an experience type." };
  if (!city || city.length > 120 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Choose a city from the list." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, error: "Choose a city from the list." };
  if (region.length > 160) return { ok: false, error: "That city label is too long." };
  if (lab.length > 160) return { ok: false, error: "Use a lab name of 160 characters or fewer." };
  if (note.length > 280) return { ok: false, error: "Keep the note to 280 characters." };
  if (!start) return { ok: false, error: "Choose a start month." };
  if (!ongoing && !end) return { ok: false, error: "Choose an end month, or mark the experience ongoing." };
  if (!ongoing && end && (end.year < start.year || (end.year === start.year && end.month < start.month))) {
    return { ok: false, error: "The end month should be the start month or later." };
  }

  return {
    ok: true,
    value: {
      role,
      organization,
      experience_type: type as ExperienceType,
      city,
      region,
      lat,
      lng,
      lab_name: lab || null,
      note: note || null,
      start_year: start.year,
      start_month: start.month,
      end_year: ongoing || !end ? null : end.year,
      end_month: ongoing || !end ? null : end.month,
      ongoing,
      shared,
    },
  };
}
