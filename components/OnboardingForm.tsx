"use client";

import { useState } from "react";
import { completeOnboarding } from "@/lib/actions";

export function OnboardingForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await completeOnboarding(formData);
    if (result?.error) {
      setPending(false);
      setError(result.error);
    }
  }

  return (
    <form className="stack" action={onSubmit}>
      <label className="block">
        <span className="label">Name</span>
        <input name="display_name" required maxLength={80} autoComplete="name" data-testid="display-name" />
      </label>
      <label className="block">
        <span className="label">Class year</span>
        <input name="class_year" inputMode="numeric" placeholder="2027" aria-describedby="year-help" />
      </label>
      <p id="year-help" className="help">
        Optional, and self-reported. Alumni can enter the year they finished.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
