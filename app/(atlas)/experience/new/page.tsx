import { BackLink } from "@/components/BackLink";
import { ExperienceForm } from "@/components/ExperienceForm";
import { requireMember } from "@/lib/session";

export default async function NewExperiencePage() {
  await requireMember();
  return (
    <div className="sheet">
      <BackLink href="/explore" label="Back" />
      <h1>Add an experience</h1>
      <p className="help">Month by month is enough. Choose a city so the atlas can place it.</p>
      <ExperienceForm />
    </div>
  );
}
