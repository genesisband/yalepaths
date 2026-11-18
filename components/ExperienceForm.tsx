"use client";

import { useState } from "react";
import { CityPicker } from "@/components/CityPicker";
import { saveExperience } from "@/lib/actions";
import { EXPERIENCE_TYPES, type Experience } from "@/lib/types";

function monthValue(year: number | null, month: number | null) {
  if (!year || !month) return "";
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ExperienceForm({ experience }: { experience?: Experience }) {
  const [ongoing, setOngoing] = useState(experience?.ongoing ?? false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await saveExperience(experience?.id ?? null, formData);
    if (result?.error) {
      setPending(false);
      setError(result.error);
    }
  }

  return (
    <form className="stack" action={onSubmit}>
      <label className="block">
        <span className="label">Role</span>
        <input name="role" required maxLength={120} defaultValue={experience?.role ?? ""} placeholder="Research assistant" data-testid="role-input" />
      </label>
      <label className="block">
        <span className="label">Organization</span>
        <input name="organization" required maxLength={160} defaultValue={experience?.organization ?? ""} placeholder="EPFL" data-testid="organization-input" />
      </label>
      <label className="block">
        <span className="label">Type</span>
        <select name="experience_type" required defaultValue={experience?.experience_type ?? ""} data-testid="type-input">
          <option value="" disabled>
            Choose a type
          </option>
          {EXPERIENCE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <CityPicker
        initial={
          experience
            ? { city: experience.city, region: experience.region, lat: experience.lat, lng: experience.lng }
            : null
        }
      />
      <label className="block">
        <span className="label">Lab</span>
        <input name="lab_name" maxLength={160} defaultValue={experience?.lab_name ?? ""} placeholder="Optional" data-testid="lab-input" />
      </label>
      <label className="block">
        <span className="label">Start</span>
        <input name="start" type="month" required defaultValue={monthValue(experience?.start_year ?? null, experience?.start_month ?? null)} data-testid="start-input" />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="ongoing"
          checked={ongoing}
          onChange={(event) => setOngoing(event.target.checked)}
        />
        <span>This is ongoing</span>
      </label>
      <label className="block">
        <span className="label">End</span>
        <input
          name="end"
          type="month"
          required={!ongoing}
          disabled={ongoing}
          defaultValue={monthValue(experience?.end_year ?? null, experience?.end_month ?? null)}
          data-testid="end-input"
        />
      </label>
      <label className="block">
        <span className="label">Note</span>
        <textarea name="note" maxLength={280} defaultValue={experience?.note ?? ""} placeholder="Optional, a sentence or two" />
      </label>
      <label className="check">
        <input type="checkbox" name="shared" defaultChecked={experience?.shared ?? false} data-testid="share-input" aria-describedby="share-help" />
        <span>Share with YalePaths members</span>
      </label>
      <p className="help" id="share-help">
        Shared entries stay searchable after they end, until you hide or delete them. Entries start private, and private entries are visible only to you.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending} data-testid="save-experience">
        {pending ? "Saving…" : experience ? "Save changes" : "Add experience"}
      </button>
    </form>
  );
}
