import { isYaleEmail } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function alreadyRegistered(message: string, code?: string): boolean {
  if (code === "email_exists" || code === "user_already_exists") return true;
  return /already|registered|exists/i.test(message);
}

/** Open a confirmed yale.edu session after CAS has validated the NetID. Does not send mail. */
export async function startCasSession(email: string): Promise<{ next: string } | { error: "session" | "domain" }> {
  if (!isYaleEmail(email)) return { error: "domain" };
  const admin = createServiceClient();
  if (!admin) return { error: "session" };

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { auth_provider: "yale_cas" },
  });
  if (createError && !alreadyRegistered(createError.message, createError.code)) return { error: "session" };

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return { error: "session" };

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError) return { error: "session" };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isYaleEmail(userData.user.email)) {
    await supabase.auth.signOut();
    return { error: "domain" };
  }

  await supabase.rpc("ensure_profile");
  const { data: marked, error: markError } = await admin
    .from("profiles")
    .update({ cas_verified: true })
    .eq("id", userData.user.id)
    .select("id");
  if (markError || !marked?.length) return { error: "session" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  const name = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  return { next: name ? "/explore" : "/onboarding" };
}
