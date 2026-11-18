import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogYears,
  companyOffset,
  companyPinsFrom,
  companySelectionKey,
  effectiveEnd,
  filterExperiences,
  matchesMapSelection,
  memberCatalog,
  overlapsYear,
  pinKey,
  pinsFrom,
  yearsOverlapped,
} from "../lib/experiences.ts";
import type { ExperienceType } from "../lib/types.ts";

const now = { year: 2026, month: 11 };

function row(partial: {
  city: string;
  region?: string;
  organization: string;
  lab_name?: string | null;
  experience_type?: ExperienceType;
  start_year: number;
  start_month: number;
  end_year?: number | null;
  end_month?: number | null;
  ongoing?: boolean;
  shared?: boolean;
  lat?: number;
  lng?: number;
}) {
  return {
    city: partial.city,
    region: partial.region ?? "",
    organization: partial.organization,
    lab_name: partial.lab_name ?? null,
    experience_type: partial.experience_type ?? "research",
    start_year: partial.start_year,
    start_month: partial.start_month,
    end_year: partial.end_year ?? null,
    end_month: partial.end_month ?? null,
    ongoing: partial.ongoing ?? false,
    shared: partial.shared ?? true,
    lat: partial.lat ?? 0,
    lng: partial.lng ?? 0,
  };
}

test("a span matches every year it overlaps, including the turn of the year", () => {
  const fixed = row({
    city: "Lausanne",
    organization: "EPFL",
    start_year: 2024,
    start_month: 6,
    end_year: 2024,
    end_month: 8,
  });
  assert.deepEqual(yearsOverlapped(fixed, now), [2024]);
  assert.equal(overlapsYear(fixed, 2023, now), false);
  assert.equal(overlapsYear(fixed, 2024, now), true);

  const across = row({
    city: "Oxford",
    organization: "University of Oxford",
    start_year: 2024,
    start_month: 11,
    end_year: 2025,
    end_month: 2,
  });
  assert.deepEqual(yearsOverlapped(across, now), [2024, 2025]);
});

test("ongoing records use the current month as the end and still include a future start", () => {
  const job = row({
    city: "New York",
    organization: "McKinsey",
    experience_type: "job",
    start_year: 2025,
    start_month: 9,
    ongoing: true,
  });
  assert.deepEqual(effectiveEnd(job, now), { year: 2026, month: 11 });
  assert.deepEqual(yearsOverlapped(job, now), [2025, 2026]);
  assert.equal(overlapsYear(job, 2027, now), false);

  const future = row({
    city: "Lausanne",
    organization: "EPFL",
    start_year: 2027,
    start_month: 6,
    ongoing: true,
  });
  assert.deepEqual(effectiveEnd(future, now), { year: 2027, month: 6 });
  assert.equal(overlapsYear(future, 2027, now), true);
  assert.equal(overlapsYear(future, 2026, now), false);
});

test("search, type, and year share one filtered set for the list and the pins", () => {
  const records = [
    row({
      city: "Lausanne",
      region: "Switzerland",
      organization: "EPFL",
      lab_name: "Atlas Pilot Lab",
      start_year: 2023,
      start_month: 6,
      end_year: 2023,
      end_month: 8,
      lat: 46.52,
      lng: 6.63,
    }),
    row({
      city: "Lausanne",
      region: "Switzerland",
      organization: "EPFL",
      experience_type: "internship",
      start_year: 2027,
      start_month: 6,
      end_year: 2027,
      end_month: 8,
      lat: 46.52,
      lng: 6.63,
    }),
    row({
      city: "Cambridge",
      region: "Massachusetts, United States",
      organization: "Broad Institute",
      lab_name: "Atlas Pilot Lab",
      start_year: 2023,
      start_month: 6,
      end_year: 2023,
      end_month: 8,
      shared: false,
      lat: 42.37,
      lng: -71.11,
    }),
  ];

  const catalog = memberCatalog(records);
  const filtered = filterExperiences(catalog, { query: "atlas pilot lab", type: "research", year: 2023 }, now);
  const pins = pinsFrom(filtered);
  const selected = pinKey(filtered[0]);
  const listed = filtered.filter((record) => pinKey(record) === selected);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].organization, "EPFL");
  assert.equal(pins.length, 1);
  assert.equal(pins[0].count, 1);
  assert.equal(pins[0].city, "Lausanne");
  assert.equal(listed.length, 1);
  assert.equal(catalogYears(catalog, now).includes(2027), true);
  assert.equal(memberCatalog(records).some((record) => record.city === "Cambridge"), false);
});

test("hiding a record removes it from the member catalog and the pin count", () => {
  const visible = row({
    city: "Lausanne",
    region: "Switzerland",
    organization: "EPFL",
    lab_name: "Atlas Pilot Lab",
    start_year: 2023,
    start_month: 6,
    end_year: 2023,
    end_month: 8,
  });
  const hidden = { ...visible, shared: false };
  const before = pinsFrom(filterExperiences(memberCatalog([visible]), { query: "atlas pilot", type: null, year: 2023 }, now));
  const after = pinsFrom(filterExperiences(memberCatalog([hidden]), { query: "atlas pilot", type: null, year: 2023 }, now));
  assert.equal(before[0].count, 1);
  assert.equal(after.length, 0);
});

test("a city with several companies splits into one dot per company", () => {
  const shared = { city: "New York", region: "New York, United States", start_year: 2024, start_month: 6, end_year: 2024, end_month: 8, lat: 40.7128, lng: -74.006 };
  const records = [
    row({ ...shared, organization: "Jane Street" }),
    row({ ...shared, organization: "Jane Street" }),
    row({ ...shared, organization: "Two Sigma" }),
  ];
  const companies = companyPinsFrom(records);
  assert.equal(companies.length, 2);
  assert.equal(companies.find((pin) => pin.organization === "Jane Street")?.count, 2);
  assert.notEqual(companies[0].lat, companies[1].lat);
  assert.equal(matchesMapSelection(records[0], companySelectionKey(records[0])), true);
  assert.equal(matchesMapSelection(records[2], companySelectionKey(records[0])), false);
  const shifted = companyOffset(40.7, -74, 1);
  assert.ok(Math.abs(shifted.lat - 40.7) > 0.001);
});
