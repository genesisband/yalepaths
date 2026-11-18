"use client";

import { useState } from "react";
import { sendCode, verifyCode } from "@/lib/actions";

export function EmailSignIn({ domainError = false }: { domainError?: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(domainError ? "YalePaths confirms the yale.edu domain before granting access." : "");
  const [pending, setPending] = useState(false);

  async function onEmail(formData: FormData) {
    setPending(true);
    setError("");
    const result = await sendCode(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setEmail(String(formData.get("email") || ""));
    setSent(true);
  }

  async function onCode(formData: FormData) {
    setPending(true);
    setError("");
    const result = await verifyCode(formData);
    if (result?.error) {
      setPending(false);
      setError(result.error);
    }
  }

  if (!sent) {
    return (
      <form className="stack" action={onEmail}>
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
            aria-describedby="email-help"
          />
        </label>
        <p id="email-help" className="help">
          We send a one-time code. The server grants access only after that code succeeds for an exact yale.edu address.
        </p>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" type="submit" disabled={pending} data-testid="continue-yale">
          {pending ? "Sending…" : "Continue with Yale email"}
        </button>
      </form>
    );
  }

  return (
    <form className="stack" action={onCode}>
      <input type="hidden" name="email" value={email} />
      <p className="help">Enter the six-digit code sent to {email}.</p>
      <label className="block">
        <span className="label">One-time code</span>
        <input
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          data-testid="code-input"
        />
      </label>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setSent(false);
          setError("");
        }}
      >
        Use a different email
      </button>
    </form>
  );
}
