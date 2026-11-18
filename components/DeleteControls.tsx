"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, deleteExperience } from "@/lib/actions";
import { SUPPORT_EMAIL } from "@/lib/public-config";

export function DeleteExperienceButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Delete this experience?")) return;
          const result = await deleteExperience(id);
          if ("error" in result) setError(result.error);
          else router.refresh();
        }}
      >
        Delete
      </button>
      {error ? <span className="alert">{error}</span> : null}
    </>
  );
}

export function DeleteAccountButton() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="danger">
      <h2>Remove your account</h2>
      <p className="help">
        This deletes the sign-in, the profile, and every experience. If you have already lost the Yale inbox, write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and ask for removal.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="text-button"
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!confirm("Delete your YalePaths account and all experiences?")) return;
          setPending(true);
          const result = await deleteAccount();
          if (result?.error) {
            setPending(false);
            setError(result.error);
          }
        }}
      >
        {pending ? "Removing…" : "Delete account"}
      </button>
    </div>
  );
}
