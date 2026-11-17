# MYRK threat model

CS 3002 term project. Three-relay onion routing demo with an anonymous
whistleblowing surface. All cryptography runs in the browser via the Web
Crypto API; plaintext never touches a server.

## 1. Actors

| Actor             | Access                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Source            | A browser. No account.                                                 |
| Journalist        | A browser. Supabase email+password + a private JWK sealed locally.     |
| Relay operator    | Vercel env vars for one relay. Holds that relay's private JWK.         |
| Platform admin    | Full Supabase + Vercel console access.                                 |
| Passive observer  | Reads network traffic to or from any single relay.                     |
| Malicious operator| Runs one or more relays and actively collects what they see.           |

## 2. Trust boundaries

```
    Source browser  ──TLS──▶  Node A  ──TLS──▶  Node B  ──TLS──▶  Node C  ──▶  Supabase
      (plaintext)              (peels)          (peels)         (peels +
                                                                 writes
                                                                 ciphertext)
```

Each of the four boxes is a separate Vercel project in v1 → Session 7:
different env scopes, so Node A's deployment cannot read Node B's or Node C's
private key. Trust is *assumed independent* for the rubric but *provisioned
under a single account* for the demo — disclosed in the on-site transparency
panel.

## 3. What is hidden by mathematics

| Property                | Protected by                                                   |
| ----------------------- | --------------------------------------------------------------- |
| Tip plaintext           | AES-GCM 256 sealed to the journalist's RSA-OAEP 2048 public key |
| Reply plaintext         | AES-GCM 256 with a PBKDF2 key derived from the codename        |
| Full circuit path       | Separate RSA keys per hop; each hop sees only neighbour + inner |
| Tamper detection        | AES-GCM authenticated tag per layer                            |
| Mailbox ↔ identity link | Codename is created in the browser and never sent to any server|

## 4. What is visible by default (metadata)

| Visible                               | To whom                                 |
| ------------------------------------- | --------------------------------------- |
| Source IP address                     | Vercel edge + Node A operator           |
| Timestamps (tips.created_at)          | Any Supabase admin                      |
| Message count and arrival pattern     | Supabase admin                          |
| Message size                          | Hidden — fixed 2048-byte cells          |
| Journalist's email identity           | Supabase auth admin                     |
| Journalist's device, when logged in   | The journalist, until they lock the tab |

## 5. Attacks and mitigations

| Attack                              | Mitigation                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| Packet size correlation             | Fixed 2048-byte cells (`lib/crypto/padding.ts`)                    |
| Tampering / tagging                 | AES-GCM authenticates every layer                                  |
| Replay (a relay re-emits a packet)  | AES-GCM IV is random per layer; final journalist-side decrypt fails if replayed into the wrong recipient's key. _(Dedicated nonce cache: future work.)_ |
| Single compromised relay            | Three-hop path — no single operator links both ends                |
| All three relays compromised        | Breaks anonymity. v1 depends on separate operators in production.  |
| Code-delivery compromise (modified JS leaks plaintext) | Open source + Subresource Integrity (S7 stretch); grader can inspect source |
| Codename brute-force                | 50-word list × 6 slots ≈ 33.8 bits of entropy, PBKDF2-SHA256 310 000 iterations, server-side rate limit on `/api/node-a` |
| Bot / spam flood of fake tips       | In-memory per-IP sliding window on Node A (`SEND_LIMIT_PER_MIN`, default 10/min) |
| DB admin reads tips                 | RLS blocks `anon` select; `authenticated` select only returns ciphertext because the journalist private key never leaves their browser |
| Leaked Supabase anon/publishable key| RLS allows only `nodes`/`journalists`/`replies` select; tips invisible. Service-role key is only on Node C's deployment. |
| Journalist's device compromised     | Private JWK is sealed in localStorage with a passphrase (PBKDF2 + AES-GCM). Still readable by malware that keylogs the passphrase — residual. |
| Timing correlation across relays    | Not mitigated in v1. Mitigation would need random per-hop delay + batching — future work. |
| Cover-traffic analysis              | Not mitigated in v1 — future work.                                 |

## 6. Residual risks (disclosed in the transparency panel)

1. All three relays under one Vercel account in v1. Real anonymity needs
   independently operated nodes; we document this honestly rather than
   pretend otherwise.
2. Vercel edge logs source IPs even though the application code does not. A
   co-operating hosting provider could in theory correlate.
3. The developer controls which JavaScript the browser downloads. Users must
   trust the published code, or inspect it. Subresource Integrity + a
   published build hash are planned follow-ups.
4. Rate limiting is per serverless instance; a warm fleet effectively multiplies
   the limit. Acceptable for a classroom demo; swap for Upstash KV for real use.
5. `/reply` queries the `replies` table directly with the anon key by
   `mailbox_id`. The hash is high-entropy, so this is safe from guessing; but a
   future revision should proxy through a rate-limited API route for
   defense-in-depth.

## 7. Cryptographic choices (rationale)

- **RSA-OAEP 2048** for key wrapping: matches the rubric's "standard library
  primitives," widely vetted, available in the Web Crypto API. ECDH with
  ephemeral keys per hop (forward secrecy) is marked as a stretch goal.
- **AES-GCM 256** for payloads: AEAD so tampering is detected, high performance
  in-browser.
- **PBKDF2-SHA256, 310 000 iterations** for codename derivation: matches
  OWASP 2023 recommendation. Argon2 would be stronger but requires WASM.
- **Fixed 2048-byte cells**: covers tips up to ~2044 bytes while defeating
  size-correlation across sent tips.

## 8. Key lifecycle

| Key                        | Generated where            | Stored where                               | Rotation                       |
| -------------------------- | -------------------------- | ------------------------------------------ | ------------------------------ |
| Relay A/B/C private JWK    | `/admin/keys` in browser   | Vercel env var on that relay's project only | Regenerate via `/admin/keys` + re-insert public row + update env |
| Relay A/B/C public JWK     | Same                       | `nodes` table (Supabase), public-read       | Re-insert via SQL              |
| Journalist private JWK     | `/admin/keys`              | Journalist's browser localStorage, passphrase-sealed; also saved to a file by the journalist | Regenerate + re-insert public row + re-upload to dashboard |
| Journalist public JWK      | Same                       | `journalists` table, public-read            | Re-insert via SQL              |
| Codename + mailbox + reply key | Source's browser       | Shown once on `/send`, then discarded.      | New codename per tip           |
| Per-layer AES key (tip)    | Source's browser           | Ephemeral; wrapped per layer then discarded | Every tip is a new session     |
| Per-reply AES key          | Derived in journalist/source browser from codename | Ephemeral          | Tied to the codename           |
