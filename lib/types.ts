export const EXPERIENCE_TYPES = [
  { value: "internship", label: "Internship" },
  { value: "research", label: "Research" },
  { value: "job", label: "Job" },
  { value: "study_abroad", label: "Study abroad" },
  { value: "other", label: "Other" },
] as const;

export type ExperienceType = (typeof EXPERIENCE_TYPES)[number]["value"];

export type Profile = {
  id: string;
  display_name: string | null;
  class_year: number | null;
  linkedin_url: string | null;
  show_linkedin: boolean;
  phone: string | null;
  show_phone: boolean;
  contact_email: string | null;
  show_contact_email: boolean;
  yale_email_verified: boolean;
  cas_verified: boolean;
};

export type PeerPlacement = {
  id: string;
  source: "summer" | "class";
  list_year: number;
  full_name: string;
  major: string | null;
  class_year: number | null;
  position_type: string | null;
  role: string | null;
  organization: string | null;
  industry: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  field_research: string | null;
  graduate_school: string | null;
};

export type ExperienceProfile = {
  display_name: string;
  class_year: number | null;
};

export type Experience = {
  id: string;
  owner_id: string;
  role: string;
  organization: string;
  experience_type: ExperienceType;
  city: string;
  region: string;
  lat: number;
  lng: number;
  lab_name: string | null;
  note: string | null;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  ongoing: boolean;
  shared: boolean;
  profile: ExperienceProfile | null;
};

export type ExperienceInput = {
  role: string;
  organization: string;
  experience_type: ExperienceType;
  city: string;
  region: string;
  lat: number;
  lng: number;
  lab_name: string | null;
  note: string | null;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  ongoing: boolean;
  shared: boolean;
};

export type MonthPoint = { year: number; month: number };

export function isExperienceType(value: string): value is ExperienceType {
  return EXPERIENCE_TYPES.some((type) => type.value === value);
}

export function typeLabel(value: string): string {
  return EXPERIENCE_TYPES.find((type) => type.value === value)?.label ?? value;
}
