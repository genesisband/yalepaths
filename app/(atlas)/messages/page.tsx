import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { requireMember } from "@/lib/session";

type MemberRow = {
  conversation_id: string;
  profile_id: string;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
};

type MessageRow = {
  conversation_id: string;
  body: string;
  created_at: string;
};

function displayName(value: MemberRow["profiles"]) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.display_name || "Member";
}

export default async function MessagesPage() {
  const { supabase, user } = await requireMember();
  const { data: memberships } = await supabase.from("conversation_members").select("conversation_id").eq("profile_id", user.id);
  const ids = (memberships ?? []).map((row) => row.conversation_id);
  const { data: memberRows } = ids.length
    ? await supabase.from("conversation_members").select("conversation_id, profile_id, profiles(display_name)").in("conversation_id", ids)
    : { data: [] };
  const { data: messageRows } = ids.length
    ? await supabase.from("messages").select("conversation_id, body, created_at").in("conversation_id", ids).order("created_at", { ascending: false })
    : { data: [] };

  const others = new Map<string, string>();
  for (const row of (memberRows ?? []) as MemberRow[]) {
    if (row.profile_id !== user.id && !others.has(row.conversation_id)) others.set(row.conversation_id, displayName(row.profiles));
  }
  const latest = new Map<string, MessageRow>();
  for (const row of (messageRows ?? []) as MessageRow[]) {
    if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row);
  }
  const conversations = [...others.entries()].sort((a, b) => {
    const aTime = latest.get(a[0])?.created_at ?? "";
    const bTime = latest.get(b[0])?.created_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="sheet">
      <BackLink href="/explore" label="Back" />
      <h1>Messages</h1>
      <p className="help">Messages stay inside YalePaths. They are separate from LinkedIn, phone, and contact email.</p>
      {conversations.length === 0 ? <p className="help">No messages yet. Open a member’s profile and choose Message.</p> : null}
      <ul className="result-list">
        {conversations.map(([id, name]) => {
          const message = latest.get(id);
          return (
            <li key={id}>
              <Link className="result-row" href={`/messages/${id}`}>
                <span className="org">{name}</span>
                <span className="meta">{message ? message.body : "No messages yet"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
