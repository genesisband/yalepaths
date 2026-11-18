import Link from "next/link";

export default function NotFound() {
  return (
    <main className="sheet">
      <h1>Not in the atlas</h1>
      <p className="help">That page is unavailable. A profile appears to other members only while it has a shared experience.</p>
      <p>
        <Link href="/explore">Back to Explore</Link>
      </p>
    </main>
  );
}
