"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions";
import type { Profile } from "@/lib/types";

export function ProfileEditor({ profile }: { profile: Profile }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setSaved(false);
    setError("");
    const result = await updateProfile(formData);
    setPending(false);
    if ("error" in result) setError(result.error);
    else setSaved(true);
  }

  return (
    <form className="stack" action={onSubmit}>
      <label className="block">
        <span className="label">Name</span>
        <input name="display_name" required maxLength={80} defaultValue={profile.display_name ?? ""} />
      </label>
      <label className="block">
        <span className="label">Class year</span>
        <input name="class_year" inputMode="numeric" defaultValue={profile.class_year ?? ""} placeholder="2027" />
      </label>
      <label className="block">
        <span className="label">LinkedIn</span>
        <input
          name="linkedin_url"
          type="url"
          placeholder="https://www.linkedin.com/in/…"
          defaultValue={profile.linkedin_url ?? ""}
        />
      </label>
      <label className="check">
        <input type="checkbox" name="show_linkedin" defaultChecked={profile.show_linkedin} />
        <span>Share this LinkedIn link with YalePaths members.</span>
      </label>
      <label className="block">
        <span className="label">Phone</span>
        <input name="phone" type="tel" placeholder="+1 203 555 0142" defaultValue={profile.phone ?? ""} />
      </label>
      <label className="check">
        <input type="checkbox" name="show_phone" defaultChecked={profile.show_phone} />
        <span>Show this phone number on your profile.</span>
      </label>
      <label className="block">
        <span className="label">Contact email</span>
        <input
          name="contact_email"
          type="email"
          placeholder="name@gmail.com"
          defaultValue={profile.contact_email ?? ""}
          aria-describedby="contact-email-help"
        />
      </label>
      <p id="contact-email-help" className="help">
        This is separate from the Yale address you use to sign in. That sign-in address stays private. Members can also message you inside YalePaths.
      </p>
      <label className="check">
        <input type="checkbox" name="show_contact_email" defaultChecked={profile.show_contact_email} />
        <span>Show this email on your profile.</span>
      </label>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p className="help">Profile saved.</p> : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
