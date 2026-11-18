import { ExploreClient } from "@/components/ExploreClient";
import { EXPERIENCE_SELECT, normalizeExperience } from "@/lib/records";
import { requireMember } from "@/lib/session";

export default async function ExplorePage() {
  const { supabase } = await requireMember();
  const { data, error } = await supabase.from("experiences").select(EXPERIENCE_SELECT).eq("shared", true);
  if (error) {
    return (
      <div className="sheet">
        <h1>Explore</h1>
        <p className="help">Shared experiences could not be loaded.</p>
      </div>
    );
  }
  const experiences = (data ?? []).map((row) => normalizeExperience(row as Record<string, unknown>));
  return <ExploreClient experiences={experiences} />;
}
