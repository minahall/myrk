"use client";
import { useState } from "react";
import Link from "next/link";
import { fetchActiveNodes, fetchJournalist } from "@/lib/supabase/client";
import { wrapOnion } from "@/lib/crypto/onion";
import { generateCodename, deriveMailbox } from "@/lib/crypto/codename";
import { exportAesRaw } from "@/lib/crypto/aes";
import { te, toBase64 } from "@/lib/crypto/util";

type Phase = "compose" | "sending" | "sent" | "error";

const RELAY_ORDER = ["a", "b", "c"] as const;

export default function SendPage() {
  const [tip, setTip] = useState("");
  const [phase, setPhase] = useState<Phase>("compose");
  const [step, setStep] = useState("");
  const [codename, setCodename] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!tip.trim()) return;
    setPhase("sending");
    setError("");

    try {
      setStep("Looking up relay keys…");
      const [nodes, journalist] = await Promise.all([fetchActiveNodes(), fetchJournalist()]);
      const hops = RELAY_ORDER.map((id) => {
        const n = nodes.find((n) => n.id === id);
        if (!n) throw new Error(`Node ${id.toUpperCase()} missing from directory`);
        return { nodeId: id, publicKey: n.public_key };
      });

      setStep("Generating codename…");
      const code = generateCodename();
      const { mailboxId, replyKey } = await deriveMailbox(code);
      const replyKeyRaw = await exportAesRaw(replyKey);

      setStep("Wrapping three onion layers…");
      const payload = JSON.stringify({
        mailboxId,
        replyKey: toBase64(replyKeyRaw),
        text: tip.trim(),
        sentAt: new Date().toISOString(),
      });
      const packet = await wrapOnion(te.encode(payload), journalist.public_key, hops);

      setStep("Sending to entry relay…");
      const nodeAUrl = process.env.NEXT_PUBLIC_NODE_A_URL || "/api/node-a";
      const res = await fetch(nodeAUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(packet),
      });
      if (!res.ok) throw new Error(`Node A rejected: HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error);

      setStep("Delivered.");
      setCodename(code);
      setPhase("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  const copyCode = () => navigator.clipboard?.writeText(codename);
  const downloadCode = () => {
    const body =
      `MYRK codename\n\n${codename}\n\n` +
      `Keep this somewhere safe. There is no recovery. ` +
      `Use it later at the site's reply page to read what the journalist sends back.\n`;
    const blob = new Blob([body], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "myrk-codename.txt";
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="s" style={{ maxWidth: 820 }}>
      <Link href="/" className="small" style={{ color: "var(--color-wisp)", textDecoration: "none" }}>
        ← back
      </Link>
      <h1 style={{ fontWeight: 400, fontSize: "clamp(2.2rem,4.4vw,3rem)", marginTop: 20 }}>
        Send a tip
      </h1>
      <p className="lede">
        Write what you know. The browser wraps it in three layers before anything leaves
        this device. You will see a codename once at the end — save it to read any reply.
      </p>

      {phase === "compose" && (
        <div className="panel">
          <label htmlFor="tip" className="lede m0">Your tip</label>
          <textarea
            id="tip"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="What do you want the journalist to know?"
            style={{ minHeight: 160 }}
          />
          <div className="row">
            <button className="btn" disabled={!tip.trim()} onClick={send}>
              Send through the relays
            </button>
            <span className="lede m0 small">Nothing leaves this device until you press Send.</span>
          </div>
        </div>
      )}

      {phase === "sending" && (
        <div className="panel">
          <p className="lede m0" aria-live="polite">{step || "Working…"}</p>
          <p className="pkt" style={{ marginTop: 20, opacity: 0.8 }}>
            Please do not close this tab.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="panel">
          <p className="lede m0" style={{ color: "var(--color-ember)" }}>Send failed</p>
          <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>
          <p className="lede small" style={{ marginTop: 14 }}>
            Common causes: Supabase env vars not set, or the <code>nodes</code> /{" "}
            <code>journalists</code> tables are empty. Visit <code>/admin/keys</code> to
            bootstrap, then re-run.
          </p>
          <div className="row">
            <button className="btn" onClick={() => setPhase("compose")}>Try again</button>
          </div>
        </div>
      )}

      {phase === "sent" && (
        <div className="panel">
          <h2 style={{ fontWeight: 400, fontSize: "1.6rem", marginBottom: 10 }}>Delivered.</h2>
          <p className="lede m0">
            Only the journalist can read this. No one on the path knows it came from you.
          </p>

          <p className="lede m0" style={{ marginTop: 28, color: "var(--color-ember)" }}>
            Your codename — shown once. Save it now. There is no recovery.
          </p>
          <div
            className={`code ${revealed ? "show" : ""}`}
            aria-hidden={!revealed}
            style={{ fontSize: "1.3rem" }}
          >
            {codename}
          </div>
          <div className="row">
            <button
              className="btn"
              onPointerDown={() => setRevealed(true)}
              onPointerUp={() => setRevealed(false)}
              onPointerLeave={() => setRevealed(false)}
              onBlur={() => setRevealed(false)}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setRevealed(true); }}
              onKeyUp={() => setRevealed(false)}
            >
              Hold to reveal
            </button>
            <button className="btn" onClick={copyCode}>Copy</button>
            <button className="btn" onClick={downloadCode}>Download .txt</button>
          </div>

          <p className="lede" style={{ marginTop: 30 }}>
            When you want to check for a reply, return to the site and open the reply page
            with your codename.
          </p>
        </div>
      )}
    </main>
  );
}
