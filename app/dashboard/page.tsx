"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { importPrivateJwk } from "@/lib/crypto/rsa";
import { importAesRaw, aesEncrypt } from "@/lib/crypto/aes";
import { openForJournalist } from "@/lib/crypto/onion";
import { te, td, toBase64, fromBase64, randomBytes } from "@/lib/crypto/util";
import { sealWithPassphrase, openWithPassphrase } from "@/lib/crypto/vault";

const VAULT_KEY = "myrk_journalist_vault_v1";

type Phase = "loading" | "signin" | "setup" | "unlock" | "ready";

type TipRow = {
  id: string;
  packet: { wk: string; iv: string; ct: string };
  created_at: string;
  read_at: string | null;
};

type DecryptedTip = {
  id: string;
  created_at: string;
  read_at: string | null;
  mailboxId: string;
  replyKey: string;
  text: string;
  sentAt?: string;
};

export default function DashboardPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [journalistKey, setJournalistKey] = useState<CryptoKey | null>(null);
  const [tips, setTips] = useState<DecryptedTip[]>([]);
  const [skipped, setSkipped] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [jwkText, setJwkText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [passphrase2, setPassphrase2] = useState("");

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        if (!data.session) return setPhase("signin");
        setSession(data.session);
        const vault = localStorage.getItem(VAULT_KEY);
        setPhase(vault ? "unlock" : "setup");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("signin");
      }
    })();
  }, []);

  async function doSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data, error: err } = await supabase().auth.signInWithPassword({ email, password });
      if (err) throw err;
      setSession(data.session);
      setPassword("");
      const vault = localStorage.getItem(VAULT_KEY);
      setPhase(vault ? "unlock" : "setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onKeyFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setJwkText(await f.text());
  }

  async function doSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!jwkText.trim()) return setError("Paste or upload your journalist private JWK first.");
    if (passphrase.length < 8) return setError("Passphrase must be at least 8 characters.");
    if (passphrase !== passphrase2) return setError("Passphrases don't match.");
    try {
      const jwk = JSON.parse(jwkText) as JsonWebKey;
      const privKey = await importPrivateJwk(jwk);
      const sealed = await sealWithPassphrase(JSON.stringify(jwk), passphrase);
      localStorage.setItem(VAULT_KEY, sealed);
      setJournalistKey(privKey);
      setPassphrase("");
      setPassphrase2("");
      setJwkText("");
      setPhase("ready");
      await loadTips(privKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sealed = localStorage.getItem(VAULT_KEY);
    if (!sealed) return setPhase("setup");
    try {
      const jwkStr = await openWithPassphrase(sealed, passphrase);
      const jwk = JSON.parse(jwkStr) as JsonWebKey;
      const privKey = await importPrivateJwk(jwk);
      setJournalistKey(privKey);
      setPassphrase("");
      setPhase("ready");
      await loadTips(privKey);
    } catch {
      setError("Wrong passphrase or corrupted vault.");
    }
  }

  async function loadTips(key: CryptoKey) {
    const { data, error: err } = await supabase()
      .from("tips")
      .select("id, packet, created_at, read_at")
      .order("created_at", { ascending: false });
    if (err) return setError(`Could not load tips: ${err.message}`);
    const ok: DecryptedTip[] = [];
    let fail = 0;
    for (const t of (data as TipRow[]) ?? []) {
      try {
        const plain = await openForJournalist(key, t.packet);
        const obj = JSON.parse(td.decode(plain)) as {
          mailboxId: string; replyKey: string; text: string; sentAt?: string;
        };
        ok.push({
          id: t.id,
          created_at: t.created_at,
          read_at: t.read_at,
          mailboxId: obj.mailboxId,
          replyKey: obj.replyKey,
          text: obj.text,
          sentAt: obj.sentAt,
        });
      } catch {
        fail++;
      }
    }
    setTips(ok);
    setSkipped(fail);
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    const { error: err } = await supabase().from("tips").update({ read_at: now }).eq("id", id);
    if (err) return setError(err.message);
    setTips(prev => prev.map(t => (t.id === id ? { ...t, read_at: now } : t)));
  }

  async function sendReply(mailboxId: string, replyKeyB64: string) {
    if (!replyText.trim()) return;
    setSending(true);
    setError("");
    try {
      const key = await importAesRaw(fromBase64(replyKeyB64));
      const iv = randomBytes(12);
      const ct = await aesEncrypt(key, iv, te.encode(replyText));
      const { error: err } = await supabase().from("replies").insert({
        mailbox_id: mailboxId,
        packet: { iv: toBase64(iv), ct: toBase64(ct) },
      });
      if (err) throw err;
      setReplyingTo(null);
      setReplyText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    setSession(null);
    setJournalistKey(null);
    setTips([]);
    setPhase("signin");
  }

  function lock() {
    setJournalistKey(null);
    setTips([]);
    setPhase("unlock");
  }

  // -------- render --------

  if (phase === "loading") {
    return <main className="s" style={{ maxWidth: 560 }}><p className="lede">Loading…</p></main>;
  }

  if (phase === "signin") {
    return (
      <main className="s" style={{ maxWidth: 480 }}>
        <Link href="/" className="small" style={{ color: "var(--color-wisp)" }}>← back</Link>
        <h1 style={{ fontWeight: 400, fontSize: "2.4rem", marginTop: 20 }}>Journalist dashboard</h1>
        <p className="lede">Sign in to see sealed tips.</p>
        <form onSubmit={doSignIn} className="panel">
          <label htmlFor="em" className="lede m0">Email</label>
          <input id="em" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
          <label htmlFor="pw" className="lede m0" style={{ marginTop: 14 }}>Password</label>
          <input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>}
          <div className="row"><button className="btn" type="submit">Sign in</button></div>
        </form>
      </main>
    );
  }

  if (phase === "setup") {
    return (
      <main className="s" style={{ maxWidth: 580 }}>
        <h1 style={{ fontWeight: 400, fontSize: "2.4rem" }}>Load your key</h1>
        <p className="lede">
          Upload the journalist private JWK you saved during bootstrap. It is sealed with a
          passphrase and kept only in this browser&apos;s local storage — never sent anywhere.
        </p>
        <form onSubmit={doSetup} className="panel">
          <label className="lede m0">Private JWK file (.json)</label>
          <input type="file" accept="application/json,.json" onChange={onKeyFile}
            style={{ display: "block", marginTop: 8 }} />
          <p className="lede small" style={{ marginTop: 10 }}>or paste the JSON directly:</p>
          <textarea value={jwkText} onChange={e => setJwkText(e.target.value)}
            placeholder='{"kty":"RSA","n":"…","e":"AQAB","d":"…",…}'
            style={{ minHeight: 100, fontFamily: "var(--font-mono)", fontSize: ".9rem" }} />
          <label className="lede m0" style={{ marginTop: 18 }}>Passphrase</label>
          <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="At least 8 characters" />
          <label className="lede m0" style={{ marginTop: 14 }}>Confirm passphrase</label>
          <input type="password" value={passphrase2} onChange={e => setPassphrase2(e.target.value)} />
          {error && <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>}
          <div className="row">
            <button className="btn" type="submit">Save and unlock</button>
            <button type="button" className="btn" onClick={signOut}>Sign out</button>
          </div>
        </form>
      </main>
    );
  }

  if (phase === "unlock") {
    return (
      <main className="s" style={{ maxWidth: 480 }}>
        <h1 style={{ fontWeight: 400, fontSize: "2.4rem" }}>Unlock</h1>
        <p className="lede">Your sealed key is in this browser. Enter the passphrase.</p>
        <form onSubmit={doUnlock} className="panel">
          <label className="lede m0">Passphrase</label>
          <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} autoFocus />
          {error && <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>}
          <div className="row">
            <button className="btn" type="submit">Unlock</button>
            <button type="button" className="btn" onClick={() => {
              localStorage.removeItem(VAULT_KEY);
              setPhase("setup"); setError(""); setPassphrase("");
            }}>Forget this device</button>
            <button type="button" className="btn" onClick={signOut}>Sign out</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="s" style={{ maxWidth: 900 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontWeight: 400, fontSize: "2.2rem", margin: 0 }}>Inbox</h1>
        <div className="row">
          <button className="btn" onClick={() => journalistKey && loadTips(journalistKey)}>Refresh</button>
          <button className="btn" onClick={lock}>Lock</button>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && <p className="pkt" style={{ marginTop: 14, color: "var(--color-ember)" }}>{error}</p>}
      {skipped > 0 && (
        <p className="pkt small" style={{ marginTop: 10, color: "var(--color-ember)" }}>
          Skipped {skipped} tip(s) that could not be decrypted (wrong key or tampered packet).
        </p>
      )}

      {tips.length === 0 && (
        <p className="lede" style={{ marginTop: 30 }}>No tips yet.</p>
      )}

      {tips.map(t => (
        <article key={t.id} className="panel" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="lede m0 small">
                Received {new Date(t.created_at).toLocaleString()}
                {" · "}
                {t.read_at
                  ? <span style={{ color: "var(--color-dim)" }}>read</span>
                  : <span style={{ color: "var(--color-wisp)" }}>new</span>}
              </p>
              <p className="lede m0 small" style={{ fontFamily: "var(--font-mono)" }}>
                mailbox: {t.mailboxId.slice(0, 16)}…
              </p>
            </div>
            {!t.read_at && (
              <button className="btn" onClick={() => markRead(t.id)}>Mark read</button>
            )}
          </div>

          <p style={{ marginTop: 18, whiteSpace: "pre-wrap", fontSize: "1.08rem" }}>{t.text}</p>

          {replyingTo === t.id ? (
            <div style={{ marginTop: 20 }}>
              <label className="lede m0">Your reply</label>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} style={{ minHeight: 100 }} />
              <div className="row">
                <button className="btn" disabled={sending || !replyText.trim()}
                  onClick={() => sendReply(t.mailboxId, t.replyKey)}>
                  {sending ? "Sending…" : "Send reply"}
                </button>
                <button className="btn" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => { setReplyingTo(t.id); setReplyText(""); }}>Reply</button>
            </div>
          )}
        </article>
      ))}
    </main>
  );
}
