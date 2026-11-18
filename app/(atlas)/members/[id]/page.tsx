import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { MessageLink } from "@/components/MessageLink";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { currentMonth } from "@/lib/experiences";
import { formatSpan, placeLabel } from "@/lib/format";
import { normalizeExperience, normalizeProfile } from "@/lib/records";
import { requireMember } from "@/lib/session";
import { typeLabel } from "@/lib/types";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireMember();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, display_name, class_year, linkedin_url, show_linkedin, phone, show_phone, contact_email, show_contact_email, yale_email_verified")
    .eq("id", id)
    .maybeSingle();
  if (!profileRow) notFound();
  const profile = normalizeProfile(profileRow as Record<string, unknown>);
  const { data } = await supabase.from("experiences").select("*").eq("owner_id", id).eq("shared", true);
  const experiences = (data ?? []).map((row) => normalizeExperience(row as Record<string, unknown>));
  if (!profile.display_name || experiences.length === 0) notFound();
  const now = currentMonth();
  const showLink = profile.show_linkedin && profile.linkedin_url;
  const showPhone = profile.show_phone && profile.phone;
  const showEmail = profile.show_contact_email && profile.contact_email;

  return (
    <div className="sheet">
      <BackLink href="/explore" label="Back" />
      {profile.yale_email_verified ? <p className="verified">Yale email verified</p> : null}
      <div className="profile-heading">
        <ProfilePortrait id={profile.id} />
        <div>
          <h1 className="profile-name">{profile.display_name}</h1>
          <p className="profile-meta">{profile.class_year ? `Class of ${profile.class_year}` : "Class year not listed"}</p>
        </div>
      </div>
      <ul className="contact-list">
        {showLink ? (
          <li>
            <a href={profile.linkedin_url!} rel="noreferrer noopener">
              LinkedIn
            </a>
          </li>
        ) : null}
        {showPhone ? (
          <li>
            <a href={`tel:${profile.phone}`}>{profile.phone}</a>
          </li>
        ) : null}
        {showEmail ? (
          <li>
            <a href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a>
          </li>
        ) : null}
        {user.id !== id ? (
          <li>
            <MessageLink profileId={id} />
          </li>
        ) : null}
      </ul>
      <ul className="result-list">
        {experiences.map((experience) => {
          const span = formatSpan(experience, now);
          return (
            <li key={experience.id} className="result-row" data-testid="profile-experience">
              <span className="org">{experience.organization}</span>
              <span className="meta">
                {typeLabel(experience.experience_type)} · {placeLabel(experience.city, experience.region)}
              </span>
              {experience.lab_name ? <span className="lab">{experience.lab_name}</span> : null}
              <span className="dates">
                {span.text}
                {span.upcoming ? " · Upcoming" : ""}
              </span>
              {experience.note ? <span className="note">{experience.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
