import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { MessageComposer } from "@/components/MessageComposer";
import { requireMember } from "@/lib/session";

type MemberRow = {
  profile_id: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

function displayName(value: MemberRow["profiles"]) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.display_name || "Member";
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireMember();
  const { data: members } = await supabase
    .from("conversation_members")
    .select("profile_id, profiles(display_name)")
    .eq("conversation_id", id);
  const rows = (members ?? []) as MemberRow[];
  if (!rows.some((row) => row.profile_id === user.id)) notFound();
  const other = rows.find((row) => row.profile_id !== user.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="sheet">
      <BackLink href="/messages" label="Back" />
      <h1>{other ? displayName(other.profiles) : "Message"}</h1>
      <ul className="result-list">
        {(messages ?? []).map((message) => (
          <li key={message.id} className="result-row">
            <span className="meta">{message.sender_id === user.id ? "You" : other ? displayName(other.profiles) : "Member"}</span>
            <span className="org">{message.body}</span>
            <span className="dates">
              {new Date(message.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
      {(messages ?? []).length === 0 ? <p className="help">Start the conversation.</p> : null}
      <MessageComposer conversationId={id} />
    </div>
  );
}
