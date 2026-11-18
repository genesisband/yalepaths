import Link from "next/link";
import { signOut } from "@/lib/actions";

export function Header({ name, showAdd = true, signedIn = false }: { name?: string | null; showAdd?: boolean; signedIn?: boolean }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href={name ? "/explore" : "/"}>
        YalePaths
      </Link>
      <nav className="header-actions" aria-label="Account">
        {showAdd ? <Link href="/explore">Explore</Link> : null}
        {showAdd ? <Link href="/messages">Messages</Link> : null}
        {showAdd ? <Link href="/experience/new">Add experience</Link> : null}
        {name ? (
          <Link className="header-name" href="/profile">
            {name}
          </Link>
        ) : null}
        {signedIn ? (
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        ) : null}
      </nav>
    </header>
  );
}
