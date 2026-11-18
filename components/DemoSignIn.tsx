"use client";

import { useState } from "react";
import { enterDemo } from "@/lib/actions";

export function DemoSignIn({ domainError = false }: { domainError?: boolean }) {
  const [error, setError] = useState(domainError ? "Use the exact yale.edu domain, like name@yale.edu." : "");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await enterDemo(formData);
    if (result?.error) {
      setPending(false);
      setError(result.error);
    }
  }

  return (
    <form className="landing-form" action={onSubmit}>
      <label className="block">
        <span className="label">Yale email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="name@yale.edu"
          data-testid="email-input"
        />
      </label>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending} data-testid="continue-yale">
        {pending ? "Opening…" : "Enter"}
      </button>
      <p className="landing-note">For this demo, that address opens the atlas. No code is sent.</p>
    </form>
  );
}
