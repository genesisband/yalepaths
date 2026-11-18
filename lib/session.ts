import { redirect } from "next/navigation";
import { isYaleEmail } from "@/lib/domain";
import { normalizeProfile } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isYaleEmail(data.user.email)) return { supabase, user: null, profile: null as Profile | null };
  const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return { supabase, user: data.user, profile: row ? normalizeProfile(row as Record<string, unknown>) : null };
}

export async function requireVerifiedUser() {
  const session = await getSessionUser();
  if (!session.user) redirect("/");
  if (!session.profile) {
    const { error } = await session.supabase.rpc("ensure_profile");
    if (error) redirect("/?error=profile");
    const { data: row } = await session.supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!row) redirect("/onboarding");
    session.profile = normalizeProfile(row as Record<string, unknown>);
  }
  return { supabase: session.supabase, user: session.user, profile: session.profile };
}

export async function requireMember() {
  const session = await requireVerifiedUser();
  if (!session.profile.display_name) redirect("/onboarding");
  return session;
}
