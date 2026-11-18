import assert from "node:assert/strict";
import test from "node:test";
import { parseContactEmail, parseExperienceForm, parseLinkedIn, parseOnboardingForm, parsePhone } from "../lib/validation.ts";

function form(entries: Record<string, string>, checks: string[] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  for (const key of checks) data.set(key, "on");
  return data;
}

test("experience validation keeps month ranges and private-by-default sharing", () => {
  const missingCity = parseExperienceForm(
    form({
      role: "Research assistant",
      organization: "EPFL",
      experience_type: "research",
      start: "2023-06",
      end: "2023-08",
    }),
  );
  assert.equal(missingCity.ok, false);

  const backwards = parseExperienceForm(
    form({
      role: "Research assistant",
      organization: "EPFL",
      experience_type: "research",
      city: "Lausanne",
      region: "Switzerland",
      lat: "46.52",
      lng: "6.63",
      start: "2023-08",
      end: "2023-06",
    }),
  );
  assert.equal(backwards.ok, false);

  const saved = parseExperienceForm(
    form(
      {
        role: "Research assistant",
        organization: "EPFL",
        experience_type: "research",
        city: "Lausanne",
        region: "Switzerland",
        lat: "46.52",
        lng: "6.63",
        lab_name: "Atlas Pilot Lab",
        note: "Membrane proteins.",
        start: "2023-06",
        end: "2023-08",
      },
      ["shared"],
    ),
  );
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.value.shared, true);
    assert.equal(saved.value.ongoing, false);
    assert.equal(saved.value.lab_name, "Atlas Pilot Lab");
  }
});

test("profile fields reject a non-LinkedIn URL and allow a blank class year", () => {
  assert.equal(parseLinkedIn("https://example.com/in/ada").ok, false);
  assert.equal(parseLinkedIn("https://www.linkedin.com/in/ada").ok, true);
  assert.equal(parsePhone("+1 203 555 0142").ok, true);
  assert.equal(parsePhone("call me").ok, false);
  assert.equal(parseContactEmail("ada.contact@gmail.com").ok, true);
  assert.equal(parseContactEmail("not-an-email").ok, false);
  const profile = parseOnboardingForm(form({ display_name: "Pilot Ada", class_year: "" }));
  assert.equal(profile.ok, true);
  if (profile.ok) assert.equal(profile.value.class_year, null);
});
