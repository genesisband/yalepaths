import Link from "next/link";
import { signOut, setSharedFromForm } from "@/lib/actions";
import { BackLink } from "@/components/BackLink";
import { DeleteAccountButton, DeleteExperienceButton } from "@/components/DeleteControls";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { formatSpan } from "@/lib/format";
import { currentMonth } from "@/lib/experiences";
import { normalizeExperience } from "@/lib/records";
import { requireMember } from "@/lib/session";
import { typeLabel, type Experience } from "@/lib/types";

export default async function ProfilePage() {
  const { supabase, profile, user } = await requireMember();
  const { data } = await supabase
    .from("experiences")
    .select("*")
    .eq("owner_id", user.id)
    .order("start_year", { ascending: false })
    .order("start_month", { ascending: false });
  const experiences = (data ?? []).map((row) => normalizeExperience(row as Record<string, unknown>));
  const now = currentMonth();

  return (
    <div className="sheet">
      <BackLink href="/explore" label="Back" />
      <p className="verified">{profile.cas_verified ? "Yale NetID verified" : "Yale email verified"}</p>
      <div className="profile-heading">
        <ProfilePortrait id={profile.id} />
        <div>
          <h1 className="profile-name">{profile.display_name}</h1>
          <p className="profile-meta">{profile.class_year ? `Class of ${profile.class_year}` : "Class year not listed"}</p>
        </div>
      </div>
      <ProfileEditor profile={profile} />
      <h2 className="city-heading">Your experiences</h2>
      {experiences.length === 0 ? <p className="help">You have not added an experience yet.</p> : null}
      <ul className="manage">
        {experiences.map((experience) => (
          <ManagedExperience key={experience.id} experience={experience} now={now} />
        ))}
      </ul>
      <form action={signOut}>
        <button className="text-button" type="submit">
          Sign out
        </button>
      </form>
      <DeleteAccountButton />
    </div>
  );
}

function ManagedExperience({ experience, now }: { experience: Experience; now: ReturnType<typeof currentMonth> }) {
  const span = formatSpan(experience, now);
  return (
    <li data-testid="managed-experience">
      <span className="org">{experience.organization}</span>
      <span className="meta">
        {typeLabel(experience.experience_type)} · {experience.city}
        {experience.region ? `, ${experience.region}` : ""}
      </span>
      {experience.lab_name ? <span className="lab">{experience.lab_name}</span> : null}
      <span className="dates">
        {span.text}
        {span.upcoming ? " · Upcoming" : ""}
      </span>
      <span className="status">{experience.shared ? "Shared" : "Private"}</span>
      <div className="row-actions">
        <Link href={`/experience/${experience.id}/edit`}>Edit</Link>
        <form action={setSharedFromForm}>
          <input type="hidden" name="id" value={experience.id} />
          <input type="hidden" name="shared" value={experience.shared ? "false" : "true"} />
          <button type="submit" data-testid={experience.shared ? "hide-experience" : "share-experience"}>
            {experience.shared ? "Hide" : "Share with YalePaths members"}
          </button>
        </form>
        <DeleteExperienceButton id={experience.id} />
      </div>
    </li>
  );
}
