"use client";

import { useState } from "react";
import { openConversation } from "@/lib/actions";

export function MessageLink({ profileId }: { profileId: string }) {
  const [error, setError] = useState("");

  return (
    <form
      action={async (formData) => {
        const result = await openConversation(formData);
        if (result?.error) setError(result.error);
      }}
    >
      <input type="hidden" name="profile_id" value={profileId} />
      <button className="text-button" type="submit">
        Message
      </button>
      {error ? (
        <span className="alert" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
