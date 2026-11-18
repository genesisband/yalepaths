import { DemoSignIn } from "@/components/DemoSignIn";
import { SUPPORT_EMAIL } from "@/lib/public-config";
import { getSessionUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const CAS_ERRORS: Record<string, string> = {
  cas: "Yale did not confirm that login. Start again from this page.",
  session: "Yale confirmed the NetID, but a session could not be started.",
  domain: "YalePaths only accepts a yale.edu NetID.",
  profile: "The NetID was confirmed, but the profile could not be created. Sign in once more.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (supabaseConfigured()) {
    const session = await getSessionUser();
    if (session.user && session.profile?.display_name) redirect("/explore");
    if (session.user) redirect("/onboarding");
  }

  const error = params.error ? CAS_ERRORS[params.error] || "" : "";

  return (
    <main className="landing">
      <p className="wordmark">YalePaths</p>
      <h1 data-testid="landing-headline">Where Yale goes.</h1>
      <p className="dek">
        A private atlas of where members work, do research, and study. Search a city, an organization, or a lab to find people heading there and people who were there before.
      </p>
      {supabaseConfigured() ? (
        <>
          <DemoSignIn domainError={params.error === "domain"} />
          {error && params.error !== "domain" ? (
            <p className="alert landing-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="landing-alt">
            <a href="/auth/cas">Continue with a Yale NetID</a>
          </p>
        </>
      ) : (
        <p className="landing-note">Add the Supabase URL and anon key in .env.local, then restart.</p>
      )}
      <p className="fine">
        YalePaths is an independent student project and is not an official Yale University service. Lost access and need the account removed? Write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
