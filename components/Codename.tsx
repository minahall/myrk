"use client";
import { useEffect, useState } from "react";

const WORDS = [
  "pale", "lantern", "ember", "hollow", "thorn", "raven",
  "moss", "bell", "ash", "tallow", "marsh", "veil",
  "cinder", "wick", "fen", "crow", "sedge", "bramble",
  "dusk", "knell",
];

function generatePreview(): string {
  // Visual-only placeholder for Session 1. Session 2 replaces this with the
  // real codename generator that also derives a mailbox ID + reply key.
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => WORDS[b % WORDS.length]).join(" ");
}

export default function Codename() {
  const [code, setCode] = useState("");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setCode(generatePreview());
  }, []);

  const show = () => setRevealed(true);
  const hide = () => setRevealed(false);

  return (
    <section className="s two" id="codename">
      <div>
        <h2>One codename. No account.</h2>
        <p className="lede">
          Your browser makes the codename and shows it once. We never store it, so we can
          never hand it back. Use it later to read the journalist's reply.
        </p>
      </div>
      <div>
        <div className={`code ${revealed ? "show" : ""}`} aria-hidden={!revealed}>
          {code}
        </div>
        <div className="row">
          <button
            className="btn"
            onPointerDown={show}
            onPointerUp={hide}
            onPointerLeave={hide}
            onBlur={hide}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") show();
            }}
            onKeyUp={hide}
          >
            Hold to reveal
          </button>
          <span className="lede m0 small">Lose it and the reply is gone for good.</span>
        </div>
      </div>
    </section>
  );
}
