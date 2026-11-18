import { isUpcoming } from "@/lib/experiences";
import type { DatedExperience } from "@/lib/experiences";
import type { MonthPoint } from "@/lib/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonth(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? "Month"} ${year}`;
}

export function formatSpan(record: DatedExperience, now: MonthPoint): { text: string; upcoming: boolean } {
  const start = formatMonth(record.start_year, record.start_month);
  const upcoming = isUpcoming(record, now);
  if (record.ongoing) return { text: `${start} – ongoing`, upcoming };
  const end = formatMonth(record.end_year ?? record.start_year, record.end_month ?? record.start_month);
  return { text: `${start} – ${end}`, upcoming };
}

export function placeLabel(city: string, region: string | null | undefined): string {
  return region ? `${city}, ${region}` : city;
}
