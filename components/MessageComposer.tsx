"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/lib/actions";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await sendMessage(conversationId, formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} className="stack" action={onSubmit}>
      <label className="block">
        <span className="label">Message</span>
        <textarea name="body" maxLength={2000} required placeholder="Write to this member" />
      </label>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
