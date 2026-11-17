"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { deriveMailbox } from "@/lib/crypto/codename";
import { aesDecrypt } from "@/lib/crypto/aes";
import { fromBase64, td } from "@/lib/crypto/util";

type Reply = { id: string; created_at: string; text: string };
type ReplyRow = { id: string; packet: { iv: string; ct: string }; created_at: string };

export default function ReplyPage() {
  const [codename, setCodename] = useState("");
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [error, setError] = useState("");

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!codename.trim()) return;
    setBusy(true);
    setError("");
    setReplies(null);
    try {
      const { mailboxId, replyKey } = await deriveMailbox(codename);
      const { data, error: err } = await supabase()
        .from("replies")
        .select("id, packet, created_at")
        .eq("mailbox_id", mailboxId)
        .order("created_at", { ascending: true });
      if (err) throw new Error(err.message);

      const rows = (data as ReplyRow[]) ?? [];
      const decrypted: Reply[] = [];
      for (const r of rows) {
        try {
          const iv = fromBase64(r.packet.iv);
          const ct = fromBase64(r.packet.ct);
          const pt = await aesDecrypt(replyKey, iv, ct);
          decrypted.push({ id: r.id, created_at: r.created_at, text: td.decode(pt) });
        } catch {
          // Row did not auth with this codename — skip silently.
        }
      }
      setReplies(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="s" style={{ maxWidth: 820 }}>
      <Link href="/" className="small" style={{ color: "var(--color-wisp)" }}>← back</Link>
      <h1 style={{ fontWeight: 400, fontSize: "clamp(2.2rem,4.4vw,3rem)", marginTop: 20 }}>
        Check for a reply
      </h1>
      <p className="lede">
        Enter the codename you were shown after sending a tip. Your browser derives the
        mailbox and decryption key locally; the server only ever sees a hash and ciphertext.
      </p>

      <form onSubmit={check} className="panel">
        <label htmlFor="cn" className="lede m0">Codename</label>
        <input
          id="cn"
          type="text"
          value={codename}
          onChange={e => setCodename(e.target.value)}
          placeholder="e.g. pale lantern ember hollow thorn raven"
          style={{ fontFamily: "var(--font-mono)" }}
          autoComplete="off"
          autoFocus
        />
        <div className="row">
          <button className="btn" type="submit" disabled={busy || !codename.trim()}>
            {busy ? "Checking…" : "Check mailbox"}
          </button>
          <span className="lede m0 small">Key derivation takes a moment — that&apos;s on purpose.</span>
        </div>
        {error && <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>}
      </form>

      {replies !== null && (
        <section style={{ marginTop: 30 }}>
          {replies.length === 0 ? (
            <p className="lede">No reply in this mailbox yet. Come back later.</p>
          ) : (
            replies.map(r => (
              <article key={r.id} className="panel" style={{ marginTop: 20 }}>
                <p className="lede m0 small">
                  Journalist · {new Date(r.created_at).toLocaleString()}
                </p>
                <p style={{ marginTop: 14, whiteSpace: "pre-wrap", fontSize: "1.08rem" }}>
                  {r.text}
                </p>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  );
}
