import { avatarFor } from "@/lib/avatars";

export function ProfilePortrait({ id }: { id: string }) {
  return <img className="profile-portrait" src={avatarFor(id)} alt="" />;
}
