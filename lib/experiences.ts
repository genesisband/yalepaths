import type { ExperienceType, MonthPoint } from "@/lib/types";

export type DatedExperience = {
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  ongoing: boolean;
};

export type Filterable = DatedExperience & {
  city: string;
  region: string;
  organization: string;
  lab_name: string | null;
  experience_type: ExperienceType;
  shared: boolean;
  lat: number;
  lng: number;
};

export type Filters = {
  query: string;
  type: ExperienceType | null;
  year: number | null;
};

export type Pin = {
  key: string;
  city: string;
  region: string;
  lat: number;
  lng: number;
  count: number;
};

export function currentMonth(date = new Date()): MonthPoint {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthIndex(point: MonthPoint): number {
  return point.year * 12 + (point.month - 1);
}

/** Ongoing records end at the current month, and never before they start. */
export function effectiveEnd(record: DatedExperience, now: MonthPoint): MonthPoint {
  if (!record.ongoing) {
    return { year: record.end_year ?? record.start_year, month: record.end_month ?? record.start_month };
  }
  const start = monthIndex({ year: record.start_year, month: record.start_month });
  const end = Math.max(start, monthIndex(now));
  return { year: Math.floor(end / 12), month: (end % 12) + 1 };
}

export function overlapsYear(record: DatedExperience, year: number, now: MonthPoint): boolean {
  const start = monthIndex({ year: record.start_year, month: record.start_month });
  const end = monthIndex(effectiveEnd(record, now));
  const yearStart = monthIndex({ year, month: 1 });
  const yearEnd = monthIndex({ year, month: 12 });
  return start <= yearEnd && end >= yearStart;
}

export function yearsOverlapped(record: DatedExperience, now: MonthPoint): number[] {
  const end = effectiveEnd(record, now).year;
  const years: number[] = [];
  for (let year = record.start_year; year <= end; year += 1) years.push(year);
  return years;
}

export function isUpcoming(record: DatedExperience, now: MonthPoint): boolean {
  return monthIndex({ year: record.start_year, month: record.start_month }) > monthIndex(now);
}

/** Shared rows are the catalog every member searches. Private rows stay with the owner. */
export function memberCatalog<T extends { shared: boolean }>(records: T[]): T[] {
  return records.filter((record) => record.shared);
}

export function pinKey(record: { city: string; region: string | null }): string {
  return `${record.city.trim().toLowerCase()}|${(record.region || "").trim().toLowerCase()}`;
}

/** Past this map zoom, a city dot opens into one dot per organization. */
export const COMPANY_ZOOM = 12;

export function companySelectionKey(record: { city: string; region: string | null; organization: string }): string {
  return `org:${pinKey(record)}::${record.organization}`;
}

export function matchesMapSelection(record: { city: string; region: string | null; organization: string }, selected: string): boolean {
  if (selected.startsWith("org:")) return companySelectionKey(record) === selected;
  return pinKey(record) === selected;
}

/** Stable spread around a city center so companies do not sit on the same pixel before an address is known. */
export function companyOffset(lat: number, lng: number, index: number): { lat: number; lng: number } {
  const meters = 340 + Math.floor(index / 6) * 280;
  const angle = index * 2.399963229728653;
  const north = Math.sin(angle) * meters;
  const east = Math.cos(angle) * meters;
  return {
    lat: lat + north / 111320,
    lng: lng + east / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))),
  };
}

export function filterExperiences<T extends Filterable>(records: T[], filters: Filters, now: MonthPoint): T[] {
  const query = filters.query.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.type && record.experience_type !== filters.type) return false;
    if (filters.year != null && !overlapsYear(record, filters.year, now)) return false;
    if (!query) return true;
    const haystack = [record.city, record.region, record.organization, record.lab_name ?? ""].join("\n").toLowerCase();
    return haystack.includes(query);
  });
}

export function catalogYears<T extends DatedExperience>(records: T[], now: MonthPoint): number[] {
  const years = new Set<number>();
  for (const record of records) {
    for (const year of yearsOverlapped(record, now)) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

export function pinsFrom<T extends Filterable>(records: T[]): Pin[] {
  const groups = new Map<string, Pin & { latSum: number; lngSum: number }>();
  for (const record of records) {
    const key = pinKey(record);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        city: record.city,
        region: record.region,
        lat: record.lat,
        lng: record.lng,
        count: 1,
        latSum: record.lat,
        lngSum: record.lng,
      });
    } else {
      existing.count += 1;
      existing.latSum += record.lat;
      existing.lngSum += record.lng;
      existing.lat = existing.latSum / existing.count;
      existing.lng = existing.lngSum / existing.count;
    }
  }
  return [...groups.values()]
    .map(({ latSum: _latSum, lngSum: _lngSum, ...pin }) => pin)
    .sort((a, b) => a.city.localeCompare(b.city) || a.region.localeCompare(b.region));
}

export type CompanyPin = Pin & { organization: string };

export function companyPinsFrom<T extends Filterable>(records: T[]): CompanyPin[] {
  const groups = new Map<string, CompanyPin & { latSum: number; lngSum: number }>();
  for (const record of records) {
    const key = companySelectionKey(record);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        city: record.city,
        region: record.region,
        organization: record.organization,
        lat: record.lat,
        lng: record.lng,
        count: 1,
        latSum: record.lat,
        lngSum: record.lng,
      });
    } else {
      existing.count += 1;
      existing.latSum += record.lat;
      existing.lngSum += record.lng;
      existing.lat = existing.latSum / existing.count;
      existing.lng = existing.lngSum / existing.count;
    }
  }
  const byCity = new Map<string, (CompanyPin & { latSum: number; lngSum: number })[]>();
  for (const pin of groups.values()) {
    const city = pinKey(pin);
    const list = byCity.get(city) ?? [];
    list.push(pin);
    byCity.set(city, list);
  }
  for (const list of byCity.values()) {
    list.sort((a, b) => a.organization.localeCompare(b.organization));
    if (list.length < 2) continue;
    list.forEach((pin, index) => {
      const shifted = companyOffset(pin.lat, pin.lng, index);
      pin.lat = shifted.lat;
      pin.lng = shifted.lng;
    });
  }
  return [...groups.values()]
    .map(({ latSum: _latSum, lngSum: _lngSum, ...pin }) => pin)
    .sort((a, b) => a.organization.localeCompare(b.organization));
}

export type CityGroup<T> = {
  key: string;
  city: string;
  region: string;
  rows: T[];
};

export function groupForIndex<T extends Filterable>(records: T[]): CityGroup<T>[] {
  const groups = new Map<string, CityGroup<T>>();
  for (const record of records) {
    const key = pinKey(record);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, city: record.city, region: record.region, rows: [record] });
    } else {
      existing.rows.push(record);
    }
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => {
      const byStart = monthIndex({ year: b.start_year, month: b.start_month }) - monthIndex({ year: a.start_year, month: a.start_month });
      return byStart || a.organization.localeCompare(b.organization);
    });
  }
  return [...groups.values()].sort((a, b) => a.city.localeCompare(b.city) || a.region.localeCompare(b.region));
}

export function pinDomId(pin: { city: string; region: string }): string {
  const slug = `${pin.city}-${pin.region}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `pin-${slug}`;
}
