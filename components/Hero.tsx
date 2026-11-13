import Link from "next/link";
import Rings from "@/components/logo/Rings";

export default function Hero() {
  return (
    <section className="hero">
      <div>
        <h1 className="word" aria-label="myrk">
          <span>m</span>
          <span>y</span>
          <span>r</span>
          <span>k</span>
        </h1>
        <p className="tag">Tell the truth. Leave no trace.</p>
        <p className="sub">
          Send a tip through three relays that each know only a third of the story.
          Only the journalist can read it.
        </p>
        <Link className="cta" href="#circuit">
          Watch a message travel
        </Link>
      </div>
      <Rings />
    </section>
  );
}
