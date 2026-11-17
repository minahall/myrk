import Link from "next/link";

export default function Nav() {
  return (
    <header className="site">
      <b>myrk</b>
      <nav className="site">
        <a href="#circuit">The circuit</a>
        <a href="#trust">What we can see</a>
        <Link href="/reply">Check for a reply</Link>
        <Link href="/send" style={{ color: "var(--color-wisp)" }}>Send a tip →</Link>
      </nav>
    </header>
  );
}
