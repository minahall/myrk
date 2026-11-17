export default function SiteFooter() {
  return (
    <footer className="site">
      Myrk is a university project on onion routing. Treat it as a demonstration until its
      relays are run by independent people.
      {" "}
      <a href="/test" style={{ color: "var(--color-wisp)", textDecoration: "none" }}>
        Crypto roundtrip →
      </a>
    </footer>
  );
}
