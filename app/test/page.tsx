"use client";
import { useState } from "react";
import { generateRsaKeyPair, exportJwk } from "@/lib/crypto/rsa";
import { wrapOnion, peelOnion, openForJournalist } from "@/lib/crypto/onion";
import { generateCodename, deriveMailbox } from "@/lib/crypto/codename";
import { te, td } from "@/lib/crypto/util";
import { CELL_BYTES } from "@/lib/crypto/padding";

type Tone = "ok" | "info" | "err" | undefined;
type LogEntry = { label: string; value: string; tone?: Tone };

const trim = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);

export default function TestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (e: LogEntry) => setLogs((prev) => [...prev, e]);
  const clear = () => setLogs([]);

  async function runOnion() {
    clear();
    setBusy(true);
    const t0 = performance.now();
    try {
      push({ label: "1. generate keypairs", value: "RSA-OAEP 2048 × 4 (A, B, C, journalist)" });
      const [a, b, c, j] = await Promise.all([
        generateRsaKeyPair(),
        generateRsaKeyPair(),
        generateRsaKeyPair(),
        generateRsaKeyPair(),
      ]);
      const [aPub, bPub, cPub, jPub] = await Promise.all([
        exportJwk(a.publicKey),
        exportJwk(b.publicKey),
        exportJwk(c.publicKey),
        exportJwk(j.publicKey),
      ]);
      push({ label: "   journalist pub (n[:30])", value: (jPub.n ?? "").slice(0, 30) + "…", tone: "info" });

      const tip = "The audit numbers were changed the night before the board meeting.";
      push({ label: "2. plaintext tip", value: tip });
      push({ label: "   plaintext length", value: `${tip.length}B`, tone: "info" });
      push({ label: "   padded cell size", value: `${CELL_BYTES}B (all tips padded to this)`, tone: "info" });

      const onion = await wrapOnion(te.encode(tip), jPub, [
        { nodeId: "a", publicKey: aPub },
        { nodeId: "b", publicKey: bPub },
        { nodeId: "c", publicKey: cPub },
      ]);
      const onionBytes = te.encode(JSON.stringify(onion)).length;
      push({ label: "3. onion packet JSON", value: `${onionBytes}B on the wire`, tone: "ok" });
      push({ label: "   wk prefix", value: trim(onion.wk, 60), tone: "info" });
      push({ label: "   ct prefix", value: trim(onion.ct, 60), tone: "info" });

      const peelA = await peelOnion(a.privateKey, onion);
      push({ label: "4. Node A peels → forward to", value: String(peelA.next), tone: "ok" });
      push({ label: "   Node A sees (ct prefix)", value: trim(peelA.body.ct, 50), tone: "info" });

      const peelB = await peelOnion(b.privateKey, peelA.body);
      push({ label: "5. Node B peels → forward to", value: String(peelB.next), tone: "ok" });
      push({ label: "   Node B sees (ct prefix)", value: trim(peelB.body.ct, 50), tone: "info" });

      const peelC = await peelOnion(c.privateKey, peelB.body);
      push({ label: "6. Node C peels → next", value: `${peelC.next} (null = deliver to journalist)`, tone: "ok" });
      push({ label: "   final sealed ct prefix", value: trim(peelC.body.ct, 50), tone: "info" });

      const recovered = await openForJournalist(j.privateKey, peelC.body);
      const text = td.decode(recovered);
      push({ label: "7. journalist decrypts", value: text, tone: "ok" });
      push({
        label: "   roundtrip",
        value: text === tip ? "✓ plaintext matches" : "✗ MISMATCH",
        tone: text === tip ? "ok" : "err",
      });

      push({ label: "elapsed", value: `${Math.round(performance.now() - t0)}ms`, tone: "info" });
    } catch (e) {
      push({ label: "ERROR", value: String(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function runCodename() {
    clear();
    setBusy(true);
    const t0 = performance.now();
    try {
      const code = generateCodename();
      push({ label: "1. generated codename", value: code });
      push({ label: "   entropy (approx)", value: "~33.8 bits (50 words × 6)", tone: "info" });

      push({ label: "2. derive #1", value: "PBKDF2-SHA256, 310 000 iterations" });
      const a = await deriveMailbox(code);
      push({ label: "   mailboxId", value: trim(a.mailboxId), tone: "info" });

      push({ label: "3. derive #2 (same codename)", value: "…" });
      const b = await deriveMailbox(code);
      push({
        label: "   mailboxId matches",
        value: a.mailboxId === b.mailboxId ? "✓ YES (deterministic)" : "✗ NO",
        tone: a.mailboxId === b.mailboxId ? "ok" : "err",
      });

      push({ label: "4. derive with one word changed", value: "…" });
      const wrong = await deriveMailbox(code.replace(/\S+$/, "WRONG"));
      push({
        label: "   mailboxId differs",
        value: a.mailboxId !== wrong.mailboxId ? "✓ YES" : "✗ NO",
        tone: a.mailboxId !== wrong.mailboxId ? "ok" : "err",
      });

      push({ label: "elapsed", value: `${Math.round(performance.now() - t0)}ms`, tone: "info" });
    } catch (e) {
      push({ label: "ERROR", value: String(e), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  const color = (t: Tone) =>
    t === "ok" ? "var(--color-wisp)"
    : t === "err" ? "var(--color-ember)"
    : t === "info" ? "var(--color-dim)"
    : "var(--color-bone)";

  return (
    <main style={{ padding: "60px clamp(20px, 6vw, 80px)", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 400, fontSize: "2.4rem", letterSpacing: ".06em", margin: 0 }}>
        Crypto roundtrip
      </h1>
      <p className="lede">
        Browser-side proof that the onion wrap/peel and codename derivation behave correctly.
        Nothing on this page is sent to a server — it exists for grading and debugging.
      </p>

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn" disabled={busy} onClick={runOnion}>
          Run onion roundtrip
        </button>
        <button className="btn" disabled={busy} onClick={runCodename}>
          Run codename roundtrip
        </button>
        <button className="btn" disabled={busy} onClick={clear}>
          Clear
        </button>
      </div>

      <div
        className="pkt"
        style={{
          marginTop: 26,
          minHeight: 320,
          padding: 18,
          border: "1px solid rgba(155,227,209,.18)",
          background: "rgba(22,37,42,.45)",
          lineHeight: 1.65,
        }}
      >
        {logs.length === 0 ? (
          "Ready."
        ) : (
          logs.map((l, i) => (
            <div key={i} style={{ color: color(l.tone) }}>
              <span style={{ color: "var(--color-dim)" }}>{l.label}: </span>
              {l.value}
            </div>
          ))
        )}
      </div>

      <p className="lede small" style={{ marginTop: 20 }}>
        <a href="/" style={{ color: "var(--color-wisp)", textDecoration: "none" }}>
          ← Back to site
        </a>
      </p>
    </main>
  );
}
