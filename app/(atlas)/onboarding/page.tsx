import { OnboardingForm } from "@/components/OnboardingForm";
import { requireVerifiedUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const { profile } = await requireVerifiedUser();
  if (profile.display_name) redirect("/explore");
  return (
    <div className="sheet">
      <p className="verified">Yale email verified</p>
      <h1>What should members call you?</h1>
      <p className="help">Your email stays in the sign-in system and is not shown on your profile.</p>
      <OnboardingForm />
    </div>
  );
}
