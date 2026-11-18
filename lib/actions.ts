"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isYaleEmail, normalizeEmail } from "@/lib/domain";
import { requireMember, requireVerifiedUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseExperienceForm, parseOnboardingForm, parseProfileForm } from "@/lib/validation";

export async function sendCode(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!isYaleEmail(email)) return { error: "Use the exact yale.edu domain, like name@yale.edu." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("yale")) return { error: error.message };
    if (message.includes("rate") || message.includes("security") || message.includes("once")) {
      return { error: "Wait a moment, then request a new code." };
    }
    return { error: "The code could not be sent. Try again." };
  }
  return { ok: true };
}

export async function verifyCode(formData: FormData): Promise<{ error: string }> {
  const email = normalizeEmail(String(formData.get("email") || ""));
  const token = String(formData.get("token") || "").replace(/\s/g, "");
  if (!isYaleEmail(email)) return { error: "Use the exact yale.edu domain, like name@yale.edu." };
  if (!/^\d{6}$/.test(token)) return { error: "Enter the six-digit code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "That code did not work. Request a new one and try again." };

  const { data } = await supabase.auth.getUser();
  if (!data.user || !isYaleEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { error: "YalePaths confirms the yale.edu domain before granting access." };
  }

  await supabase.rpc("ensure_profile");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
  redirect(profile?.display_name ? "/explore" : "/onboarding");
}

export async function completeOnboarding(formData: FormData): Promise<{ error: string }> {
  const session = await requireVerifiedUser();
  const parsed = parseOnboardingForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await session.supabase
    .from("profiles")
    .update({ display_name: parsed.value.display_name, class_year: parsed.value.class_year })
    .eq("id", session.user.id);
  if (error) return { error: "The profile could not be saved." };
  redirect("/explore");
}

export async function updateProfile(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const session = await requireMember();
  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await session.supabase.from("profiles").update(parsed.value).eq("id", session.user.id);
  if (error) return { error: "The profile could not be saved." };
  revalidatePath("/profile");
  revalidatePath(`/members/${session.user.id}`);
  return { ok: true };
}

export async function saveExperience(id: string | null, formData: FormData): Promise<{ error: string }> {
  const session = await requireMember();
  const parsed = parseExperienceForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  if (id) {
    const { data, error } = await session.supabase.from("experiences").update(parsed.value).eq("id", id).select("id").maybeSingle();
    if (error || !data) return { error: "You can only edit your own entries." };
  } else {
    const { error } = await session.supabase.from("experiences").insert({ ...parsed.value, owner_id: session.user.id });
    if (error) return { error: "The experience could not be saved." };
  }

  revalidatePath("/explore");
  revalidatePath("/profile");
  revalidatePath(`/members/${session.user.id}`);
  redirect("/profile");
}

export async function setSharedFromForm(formData: FormData) {
  const session = await requireMember();
  const id = String(formData.get("id") || "");
  const shared = formData.get("shared") === "true";
  const { data, error } = await session.supabase.from("experiences").update({ shared }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return;
  revalidatePath("/explore");
  revalidatePath("/profile");
  revalidatePath(`/members/${session.user.id}`);
}

export async function deleteExperience(id: string): Promise<{ error: string } | { ok: true }> {
  const session = await requireMember();
  const { data, error } = await session.supabase.from("experiences").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) return { error: "You can only delete your own entries." };
  revalidatePath("/explore");
  revalidatePath("/profile");
  revalidatePath(`/members/${session.user.id}`);
  return { ok: true };
}

function demoSignInAllowed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}

export async function enterDemo(formData: FormData): Promise<{ error: string }> {
  if (!demoSignInAllowed()) return { error: "This sign-in is only available on the local demo." };
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!isYaleEmail(email)) return { error: "Use the exact yale.edu domain, like name@yale.edu." };
  const admin = createServiceClient();
  if (!admin) return { error: "The demo sign-in is not configured." };

  const password = "yalepaths-local-demo";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return { error: "The atlas could not be opened. Try that address again." };
  }
  if (created.error) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed.data.users.find((user) => user.email === email);
    if (!existing) return { error: "The atlas could not be opened. Try that address again." };
    const updated = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (updated.error) return { error: "The atlas could not be opened. Try that address again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || !isYaleEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { error: "The atlas could not be opened. Try that address again." };
  }
  await supabase.rpc("ensure_profile");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
  redirect(profile?.display_name ? "/explore" : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(): Promise<{ error: string }> {
  const session = await requireVerifiedUser();
  const { error } = await session.supabase.rpc("delete_own_account");
  if (error) {
    const admin = createServiceClient();
    if (!admin) return { error: "The account could not be removed. Write to the support contact." };
    const { error: adminError } = await admin.auth.admin.deleteUser(session.user.id);
    if (adminError) return { error: "The account could not be removed. Write to the support contact." };
  }
  await session.supabase.auth.signOut();
  redirect("/");
}

export async function openConversation(formData: FormData): Promise<{ error: string }> {
  const session = await requireMember();
  const other = String(formData.get("profile_id") || "");
  const { data, error } = await session.supabase.rpc("open_conversation", { other_profile: other });
  if (error || !data) return { error: "You can message members who have shared an experience." };
  redirect(`/messages/${data}`);
}

export async function sendMessage(conversationId: string, formData: FormData): Promise<{ error: string } | { ok: true }> {
  const session = await requireMember();
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > 2000) return { error: "Keep the message to 2000 characters." };
  const { error } = await session.supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: session.user.id,
    body,
  });
  if (error) return { error: "The message could not be sent." };
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true };
}
