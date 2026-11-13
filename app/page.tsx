import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Circuit from "@/components/Circuit";
import Codename from "@/components/Codename";
import TrustPanel from "@/components/TrustPanel";
import SiteFooter from "@/components/SiteFooter";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Circuit />
        <Codename />
        <TrustPanel />
      </main>
      <SiteFooter />
    </>
  );
}
