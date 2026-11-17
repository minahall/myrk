"use client";
import { useEffect, useRef, useState } from "react";
import { generateRsaKeyPair, exportJwk } from "@/lib/crypto/rsa";
import { wrapOnion, peelOnion, openForJournalist } from "@/lib/crypto/onion";
import { te, td } from "@/lib/crypto/util";

const CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789+/=";
const rnd = (n: number) =>
  Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const trim = (s: string, n = 72) => (s.length > n ? s.slice(0, n) + "…" : s);

const ADV: Record<number, string> = {
  1: "The entry relay sees your address, but not the destination or the message.",
  2: "The middle relay sees only its two neighbours. It learns nothing about either end.",
  3: "The exit relay sees the journalist's address, but not who sent the message.",
};
const LABEL: Record<number, string> = { 1: "Entry", 2: "Middle", 3: "Exit" };

type DemoKeys = {
  a: CryptoKeyPair; b: CryptoKeyPair; c: CryptoKeyPair; j: CryptoKeyPair;
  aJwk: JsonWebKey; bJwk: JsonWebKey; cJwk: JsonWebKey; jJwk: JsonWebKey;
};

export default function Circuit() {
  const stageRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<DemoKeys | null>(null);

  const [tip, setTip] = useState(
    "The audit numbers were changed the night before the board meeting."
  );
  const [pkt, setPkt] = useState("Ready.");
  const [out, setOut] = useState("");
  const [lit, setLit] = useState<Set<number>>(new Set([0]));
  const [litCards, setLitCards] = useState<Set<number>>(new Set());
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [keysReady, setKeysReady] = useState(false);

  async function ensureKeys(): Promise<DemoKeys> {
    if (keysRef.current) return keysRef.current;
    const [a, b, c, j] = await Promise.all([
      generateRsaKeyPair(), generateRsaKeyPair(),
      generateRsaKeyPair(), generateRsaKeyPair(),
    ]);
    const [aJwk, bJwk, cJwk, jJwk] = await Promise.all([
      exportJwk(a.publicKey), exportJwk(b.publicKey),
      exportJwk(c.publicKey), exportJwk(j.publicKey),
    ]);
    keysRef.current = { a, b, c, j, aJwk, bJwk, cJwk, jJwk };
    setKeysReady(true);
    return keysRef.current;
  }

  const nodePos = (i: number): number => {
    const stage = stageRef.current;
    if (!stage) return 0;
    const dot = stage.querySelector<HTMLElement>(`[data-i="${i}"] .dot`);
    if (!dot) return 0;
    const d = dot.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return d.left - s.left + d.width / 2 - 22;
  };
  const goTo = (i: number) => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.style.left = nodePos(i) + "px";
  };

  const scramble = async (final: string, ms: number) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      setPkt(rnd(final.length || 60));
      await sleep(45);
    }
    setPkt(final);
  };

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setSent(false);
    setLit(new Set([0]));
    setLitCards(new Set());
    setGone(new Set());
    setOut("");

    const orb = orbRef.current;
    if (orb) {
      orb.style.transition = "none";
      goTo(0);
      void orb.offsetWidth;
      orb.style.transition = "";
    }

    try {
      if (!keysRef.current) setPkt("Generating ephemeral demo keys…");
      const k = await ensureKeys();

      const plaintext = tip.trim() || "(empty tip)";
      const outer = await wrapOnion(te.encode(plaintext), k.jJwk, [
        { nodeId: "a", publicKey: k.aJwk },
        { nodeId: "b", publicKey: k.bJwk },
        { nodeId: "c", publicKey: k.cJwk },
      ]);
      const peelA = await peelOnion(k.a.privateKey, outer);
      const peelB = await peelOnion(k.b.privateKey, peelA.body);
      const peelC = await peelOnion(k.c.privateKey, peelB.body);
      const recovered = td.decode(await openForJournalist(k.j.privateKey, peelC.body));

      await scramble(trim(outer.ct), 700);

      const inners = [peelA.body.ct, peelB.body.ct, peelC.body.ct];
      for (const i of [1, 2, 3]) {
        goTo(i);
        await sleep(1700);
        setLit((prev) => new Set(prev).add(i));
        setLitCards((prev) => new Set(prev).add(i));
        setGone((prev) => new Set(prev).add(i));
        await scramble(trim(inners[i - 1]), 500);
      }

      goTo(4);
      await sleep(1700);
      setLit((prev) => new Set(prev).add(4));
      await scramble(recovered.slice(0, 90), 500);
      setOut(
        "Delivered. Only the journalist could unseal this, and nobody on the path learned who it came from."
      );
      setSent(true);
    } catch (e) {
      setPkt("");
      setOut("Demo crypto failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const toggleBad = (i: number) => {
    setBad((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  useEffect(() => {
    goTo(0);
    const onResize = () => {
      const orb = orbRef.current;
      if (!orb) return;
      orb.style.transition = "none";
      goTo(0);
      void orb.offsetWidth;
      orb.style.transition = "";
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bs = [1, 2, 3].filter((i) => bad.has(i));
  const advText =
    bs.length === 3
      ? "All three are compromised. The whole path can be traced from you to the journalist. This is why relays need different operators."
      : bs.includes(1) && bs.includes(3)
      ? "Entry and exit are compromised. Matching packet timing and size could link you to the journalist. Random delays, padding and cover traffic defend against this."
      : bs.length
      ? bs.map((i) => ADV[i]).join(" ")
      : "Click a relay to compromise it and see what an attacker learns.";
  const advBad = bs.length > 1;

  return (
    <section className="s" id="circuit">
      <h2>Watch a message lose its name</h2>
      <p className="lede">
        Your message is wrapped in three layers. Each relay removes one and learns almost
        nothing. The packet below is the real ciphertext handed from node to node, run
        through the same Web Crypto library the live site uses. Click a relay afterwards to
        see what an attacker would learn.
      </p>
      <div className="panel">
        <label htmlFor="msg" className="lede m0">Your tip</label>
        <textarea id="msg" value={tip} onChange={(e) => setTip(e.target.value)} />
        <div className="row">
          <button className="btn" disabled={busy} onClick={send}>
            {sent ? "Send again" : "Send through the relays"}
          </button>
          <span className="lede m0 small">
            {keysReady ? "Demo keys ready." : "First run generates demo keys — takes a second."}
          </span>
        </div>
        <div className="stage" ref={stageRef}>
          <div className="orb" ref={orbRef}>
            <span className={`o1 ${gone.has(1) ? "gone" : ""}`} />
            <span className={`o2 ${gone.has(2) ? "gone" : ""}`} />
            <span className={`o3 ${gone.has(3) ? "gone" : ""}`} />
            <span className="oc" />
          </div>
          <div className={`node ${lit.has(0) ? "lit" : ""}`} data-i={0}>
            <span className="dot" />You
          </div>
          {[1, 2, 3].map((i) => (
            <button
              key={i}
              data-i={i}
              className={`node ${lit.has(i) ? "lit" : ""} ${bad.has(i) ? "bad" : ""}`}
              aria-pressed={bad.has(i)}
              onClick={() => toggleBad(i)}
            >
              <span className="dot" />
              {LABEL[i]}
            </button>
          ))}
          <div className={`node ${lit.has(4) ? "lit" : ""}`} data-i={4}>
            <span className="dot" />Journalist
          </div>
        </div>
        <p className="pkt" aria-live="polite">{pkt}</p>
        <p className="out">{out}</p>
        <div className="cards">
          <div className={`card ${litCards.has(1) ? "lit" : ""}`}>
            <h3>Entry relay</h3>
            Sees your address. Cannot see where the packet goes or what it says.
          </div>
          <div className={`card ${litCards.has(2) ? "lit" : ""}`}>
            <h3>Middle relay</h3>
            Sees only the entry and the exit. Cannot tell who sent it or who gets it.
          </div>
          <div className={`card ${litCards.has(3) ? "lit" : ""}`}>
            <h3>Exit relay</h3>
            Sees the journalist's address. Cannot see who sent it, and the message stays sealed.
          </div>
        </div>
        <p className={`adv ${advBad ? "bad" : ""}`}>{advText}</p>
      </div>
    </section>
  );
}
