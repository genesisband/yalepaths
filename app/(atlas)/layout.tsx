import { Header } from "@/components/Header";
import { requireVerifiedUser } from "@/lib/session";

export default async function AtlasLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireVerifiedUser();
  return (
    <div className="atlas-shell">
      <Header name={profile.display_name} showAdd={Boolean(profile.display_name)} signedIn />
      <div className="atlas-main">{children}</div>
    </div>
  );
}
