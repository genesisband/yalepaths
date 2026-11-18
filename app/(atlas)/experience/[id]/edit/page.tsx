import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { ExperienceForm } from "@/components/ExperienceForm";
import { normalizeExperience } from "@/lib/records";
import { requireMember } from "@/lib/session";

export default async function EditExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireMember();
  const { data } = await supabase.from("experiences").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="sheet">
      <BackLink href="/profile" label="Back" />
      <h1>Edit experience</h1>
      <ExperienceForm experience={normalizeExperience(data as Record<string, unknown>)} />
    </div>
  );
}
