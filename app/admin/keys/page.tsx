"use client";
import { useState } from "react";
import { generateRsaKeyPair, exportJwk } from "@/lib/crypto/rsa";

type KeyPack = { id: string; publicJwk: JsonWebKey; privateJwk: JsonWebKey };
type Journalist = { name: string; publicJwk: JsonWebKey; privateJwk: JsonWebKey };

const sqlEscape = (s: string) => s.replace(/'/g, "''");

export default function KeysPage() {
  const [nodes, setNodes] = useState<KeyPack[]>([]);
  const [journalist, setJournalist] = useState<Journalist | null>(null);
  const [journalistName, setJournalistName] = useState("Reed Hollow");
  const [busy, setBusy] = useState(false);

  async function gen() {
    setBusy(true);
    try {
      const pairs = await Promise.all(
        ["a", "b", "c"].map(async (id) => {
          const kp = await generateRsaKeyPair();
          return {
            id,
            publicJwk: await exportJwk(kp.publicKey),
            privateJwk: await exportJwk(kp.privateKey),
          };
        })
      );
      setNodes(pairs);
      const jkp = await generateRsaKeyPair();
      setJournalist({
        name: journalistName,
        publicJwk: await exportJwk(jkp.publicKey),
        privateJwk: await exportJwk(jkp.privateKey),
      });
    } finally {
      setBusy(false);
    }
  }

  const copy = (s: string) => navigator.clipboard?.writeText(s);
  const download = (name: string, s: string) => {
    const blob = new Blob([s], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  };

  const sqlForNode = (n: KeyPack) =>
    `insert into nodes (id, public_key) values ('${n.id}', '${sqlEscape(
      JSON.stringify(n.publicJwk)
    )}'::jsonb)\n  on conflict (id) do update set public_key = excluded.public_key, status = 'active';`;

  const sqlForJournalist = (j: Journalist) =>
    `insert into journalists (name, public_key) values ('${sqlEscape(j.name)}', '${sqlEscape(
      JSON.stringify(j.publicJwk)
    )}'::jsonb);`;

  return (
    <main style={{ padding: "60px clamp(20px,6vw,80px)", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 400, fontSize: "2.4rem", margin: 0 }}>Key generation</h1>
      <p className="lede" style={{ color: "var(--color-ember)" }}>
        Developer tool. Runs locally in your browser; nothing is sent to any server. Save
        the output privately — close this tab and these keys are gone forever.
      </p>
      <p className="lede">
        One click generates 4 RSA-OAEP 2048 keypairs — nodes A, B, C and one journalist.
        Each node&apos;s private JWK goes into that node&apos;s Vercel env var
        (<code>NODE_A_PRIVATE_KEY</code> etc.). Public JWKs are inserted into Supabase via
        the SQL shown below. The journalist&apos;s private JWK is their dashboard login
        (Session 5) — download it.
      </p>

      <div className="row" style={{ marginTop: 24 }}>
        <label className="lede m0" htmlFor="jname">Journalist name:</label>
        <input
          id="jname"
          value={journalistName}
          onChange={(e) => setJournalistName(e.target.value)}
          style={{
            background: "transparent",
            border: "1px solid rgba(232,228,212,.3)",
            color: "var(--color-bone)",
            padding: "6px 10px",
            font: "inherit",
          }}
        />
        <button className="btn" disabled={busy} onClick={gen}>
          {busy ? "Generating…" : "Generate all keys"}
        </button>
      </div>

      {nodes.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2>Relay nodes</h2>
          {nodes.map((n) => (
            <div key={n.id} className="panel" style={{ marginTop: 20 }}>
              <h3 style={{ fontWeight: 400, fontSize: "1.3rem" }}>Node {n.id.toUpperCase()}</h3>

              <p className="lede m0" style={{ marginTop: 14 }}>
                Vercel env var <code>NODE_{n.id.toUpperCase()}_PRIVATE_KEY</code>:
              </p>
              <pre className="pkt" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(n.privateJwk)}
              </pre>
              <div className="row">
                <button className="btn" onClick={() => copy(JSON.stringify(n.privateJwk))}>
                  Copy private JWK
                </button>
                <button
                  className="btn"
                  onClick={() => download(`node-${n.id}-private.jwk.json`, JSON.stringify(n.privateJwk, null, 2))}
                >
                  Download .json
                </button>
              </div>

              <p className="lede m0" style={{ marginTop: 22 }}>
                Supabase SQL (paste in SQL editor):
              </p>
              <pre className="pkt" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {sqlForNode(n)}
              </pre>
              <div className="row">
                <button className="btn" onClick={() => copy(sqlForNode(n))}>
                  Copy SQL
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {journalist && (
        <section style={{ marginTop: 40 }}>
          <h2>Journalist</h2>
          <div className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ fontWeight: 400, fontSize: "1.3rem" }}>{journalist.name}</h3>

            <p className="lede m0" style={{ marginTop: 14, color: "var(--color-ember)" }}>
              Private JWK — DOWNLOAD and keep safe. This is the only way to read tips.
              No recovery.
            </p>
            <pre className="pkt" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(journalist.privateJwk, null, 2)}
            </pre>
            <div className="row">
              <button className="btn" onClick={() => copy(JSON.stringify(journalist.privateJwk))}>
                Copy
              </button>
              <button
                className="btn"
                onClick={() =>
                  download(
                    "journalist-private.jwk.json",
                    JSON.stringify(journalist.privateJwk, null, 2)
                  )
                }
              >
                Download .json
              </button>
            </div>

            <p className="lede m0" style={{ marginTop: 22 }}>
              Supabase SQL (journalists table):
            </p>
            <pre className="pkt" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
              {sqlForJournalist(journalist)}
            </pre>
            <div className="row">
              <button className="btn" onClick={() => copy(sqlForJournalist(journalist))}>
                Copy SQL
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
