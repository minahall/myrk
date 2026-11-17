# MYRK — Anonymous Whistleblowing (CS 3002 project)

Three-relay onion routing demo. All cryptography runs in the browser via the
Web Crypto API; plaintext never touches a server.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind v4 · Supabase · Vercel.

---

## Hard rules

- No custom crypto primitives. Web Crypto API only.
- Plaintext never leaves the browser. All wrapping and unwrapping of the user's
  message is client-side.
- Each relay node knows only its neighbours. Nodes never store payloads and
  strip IP headers wherever the platform allows.
- v1 scope: RSA-OAEP 2048 key-wrap + AES-GCM 256 payload, text-only tips,
  single journalist. Attachments and ECDH forward secrecy are stretch.

## Design tokens (see `app/globals.css`)

| Token          | Value    | Role                   |
| -------------- | -------- | ---------------------- |
| `--color-murk` | #0d171a  | background             |
| `--color-fog`  | #16252a  | panel surfaces         |
| `--color-bone` | #e8e4d4  | primary text           |
| `--color-wisp` | #9be3d1  | accent (spectral green)|
| `--color-ember`| #e0623a  | danger / adversary     |
| `--color-dim`  | #8a9a98  | muted text             |

Fonts: `IM Fell English` (serif, headlines + body) · `IBM Plex Mono`
(technical / packet strings).

Atmosphere: fog (3 blurred blobs, `app/globals.css` → `.fog`), SVG grain, ghost
cursor trail. Signature motif: three rings around a glowing core that dissolve
outward as the message travels.

## Directory map

```
app/
  layout.tsx          Root layout — atmosphere components + fonts
  page.tsx            Landing: Nav, Hero, Circuit, Codename, TrustPanel, Footer
  globals.css         Tailwind + design tokens + component CSS
components/
  background/         Fog, Grain, GhostCursor
  logo/Rings.tsx      Three-ring + core SVG
  Nav, Hero, Circuit, Codename, TrustPanel, SiteFooter
lib/
  crypto/             rsa.ts, aes.ts, onion.ts, codename.ts, padding.ts, util.ts
  supabase/           client.ts (anon), admin.ts (service_role, Node C only)
  relay/              node.ts — shared peel/forward/deliver handler
app/api/
  node-a/route.ts     Entry relay (CORS), forwards to B
  node-b/route.ts     Middle relay, forwards to C
  node-c/route.ts     Exit relay, delivers to Supabase tips table
app/
  send/               Source submission flow
  admin/keys/         Developer tool: generate all 4 keypairs + SQL
  test/               Crypto roundtrip
supabase/
  schema.sql          Database + RLS policies
```

## Supabase schema (full SQL in `supabase/schema.sql`)

- `nodes(id text pk, public_key jsonb, status text)` — public read.
- `journalists(id uuid pk, name text, public_key jsonb)` — public read.
- `tips(id, packet jsonb, created_at, read_at)` — `packet` is the sealed-for-journalist
  `HybridPacket {wk, iv, ct}`. Insert: service_role only (Node C). Select: authenticated journalist.
- `replies(id, mailbox_id text, packet jsonb, created_at)` — `packet` is AES-GCM only
  `{iv, ct}` (no RSA wrap; AES key is derived from the codename). Insert: authenticated
  journalist. Select by `mailbox_id`: public (the hash is the capability).

## Crypto API (implemented, `lib/crypto/`)

Wire format: every packet on the network is a `HybridPacket = {wk, iv, ct}` —
AES-GCM ciphertext with a per-layer AES-256 key, wrapped by the recipient's
RSA-OAEP public key. Each layer's plaintext is `{ next: nodeId|null, body: b64 }`,
where `body` is the next inner `HybridPacket` serialized as JSON. Innermost
payload is `pad(tip, 2048)` sealed to the journalist. Null `next` means deliver.

```ts
// lib/crypto/rsa.ts
generateRsaKeyPair(): Promise<CryptoKeyPair>
exportJwk(key): Promise<JsonWebKey>
importPublicJwk(jwk) / importPrivateJwk(jwk)
rsaWrap(publicKey, aesRaw) / rsaUnwrap(privateKey, wrapped)

// lib/crypto/aes.ts
generateAesKey() / exportAesRaw(k) / importAesRaw(raw)
aesEncrypt(key, iv, data) / aesDecrypt(key, iv, ct)

// lib/crypto/onion.ts
type Hop = { nodeId: string; publicKey: JsonWebKey }
wrapOnion(tip: Uint8Array, journalistKey: JsonWebKey, hops: Hop[]): Promise<HybridPacket>
peelOnion(privateKey, pkt): Promise<{ next: string|null; body: HybridPacket }>
openForJournalist(privateKey, pkt): Promise<Uint8Array>   // unseals + unpads

// lib/crypto/codename.ts
generateCodename(wordCount = 6): string                    // 50-word list
deriveMailbox(codename): Promise<{ mailboxId, replyKey }>  // PBKDF2-SHA256, 310 000 iters
normalizeCodename(s): string

// lib/crypto/padding.ts
CELL_BYTES = 2048
pad(payload) / unpad(cell)                                 // [u32 len][payload][random fill]
```

Verify in the browser: `/test` runs full onion wrap → 3 peels → journalist
decrypt and codename-derive consistency.

## Source submission flow (`/send`)

Tip payload (sealed inside the innermost layer, decryptable only by the journalist):

```json
{
  "mailboxId": "<base64 — PBKDF2(mailbox salt, codename)>",
  "replyKey":  "<base64 — PBKDF2(reply salt, codename) as AES-256 raw>",
  "text":      "<the tip>",
  "sentAt":    "<ISO timestamp>"
}
```

Steps the browser runs on Send:
1. `fetchActiveNodes()` + `fetchJournalist()` from Supabase (public read).
2. `generateCodename()` → `deriveMailbox()` to get `mailboxId` + `replyKey`.
3. Build the JSON payload above.
4. `wrapOnion(payload, journalistKey, [A, B, C])`.
5. POST the outer `HybridPacket` to `/api/node-a`.
6. On success, reveal the codename once (hold-to-reveal + copy + download .txt).

The codename is never sent anywhere. Server sees ciphertext only.

## Journalist dashboard (`/dashboard`)

Three-step gate: Supabase email+password → passphrase vault for the private JWK
→ decrypted inbox.

- Auth: Supabase Auth (email + password). Create the account once via Supabase
  Dashboard → Authentication → Users → Add user, with email_confirm true.
- Key vault: `lib/crypto/vault.ts` seals the journalist's private JWK with a
  passphrase (PBKDF2-SHA256 310 000 iters + AES-GCM) and stores the envelope
  in localStorage under `myrk_journalist_vault_v1`. First visit: Setup (upload
  JWK file or paste, pick passphrase). Later visits: Unlock. "Forget this
  device" wipes the envelope.
- Inbox: `tips` rows pulled, each `packet` passed to `openForJournalist()`.
  The inner JSON gives `{mailboxId, replyKey, text, sentAt}` — mailbox + reply
  key are used to compose the reply inline.
- Reply: journalist encrypts text with the codename-derived AES key
  (`importAesRaw(fromBase64(replyKey))`) and inserts `{mailbox_id, packet}`
  into `replies`. RLS allows the authenticated journalist to insert.

## Source reply retrieval (`/reply`)

Codename → `deriveMailbox()` → `{mailboxId, replyKey}`. Query
`replies.select().eq("mailbox_id", mailboxId)` (anon select by mailbox_id is
allowed — the hash is the capability). Each row's packet is AES-GCM decrypted
with the derived replyKey. Rows that don't auth are silently skipped.

## Circuit demo uses real crypto

`components/Circuit.tsx` lazily generates 4 ephemeral RSA-OAEP keypairs on
first "Send". Each run calls `wrapOnion` → three real `peelOnion` calls → one
`openForJournalist`. The packet strings scrolling in the UI are the actual
ciphertext prefixes handed between the nodes, not scripted text.

## Bootstrap: generating keys

`/admin/keys` is a browser-only dev tool. One click generates 4 RSA-OAEP 2048
keypairs (nodes A, B, C + journalist) and prints:
- node private JWK → paste into that node's `NODE_*_PRIVATE_KEY` Vercel env var
- node public JWK → `insert into nodes ...` SQL snippet for Supabase SQL editor
- journalist private JWK → download, used in Session 5 dashboard login
- journalist public JWK → `insert into journalists ...` SQL snippet

Nothing from this page is sent to any server. Close the tab and lost material
is unrecoverable.

## Relay pipeline (`app/api/node-{a,b,c}/route.ts`)

Shared handler in `lib/relay/node.ts`. Each route:
1. Reads its private JWK from `NODE_{A,B,C}_PRIVATE_KEY` (cached per instance).
2. Calls `peelOnion()` to remove one layer.
3. If `next` is a nodeId, POSTs the inner `HybridPacket` to that relay's URL.
4. If `next` is null (Node C only), inserts the inner packet into `tips`
   using the service_role Supabase client (`lib/supabase/admin.ts`).

Nodes log nothing about the payload — only `{ accepted, stage, forwardedTo? }`.
Node A is the only CORS-exposed endpoint (frontend origin via `ALLOWED_ORIGIN`).

## Environment variables

Full list in `.env.example`. Full production walkthrough in `DEPLOY.md`.

```
Frontend:   NODE_ROLE=frontend, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
            NEXT_PUBLIC_NODE_A_URL
Node A:     NODE_ROLE=a, NODE_A_PRIVATE_KEY, NODE_B_URL, ALLOWED_ORIGIN, SEND_LIMIT_PER_MIN
Node B:     NODE_ROLE=b, NODE_B_PRIVATE_KEY, NODE_C_URL
Node C:     NODE_ROLE=c, NODE_C_PRIVATE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

Locally one Next.js process acts as every relay — set none of `NODE_ROLE` and
put every variable above into `.env.local`. `middleware.ts` keeps unused
relay routes dark on each production deployment.

## Session progression

- **S1 ✓** Scaffold + design port + schema file.
- **S2 ✓** `lib/crypto/*` primitives + `/test` roundtrip page.
- **S3 ✓** `/send` flow + `/admin/keys` bootstrap + `/api/node-a` stub.
- **S4 ✓** Real 3-relay pipeline: `/api/node-{a,b,c}` peel + forward; Node C writes to `tips`.
- **S5 ✓** `/dashboard`: Supabase auth sign-in + passphrase-sealed JWK vault + inbox decrypt + reply.
- **S6 ✓** `/reply` source-side mailbox + Circuit demo runs real ephemeral wrap/peel.
- **S7 ✓** `middleware.ts` gates relay routes by `NODE_ROLE`, rate limit on Node A, DEPLOY.md and THREAT-MODEL.md.

## Open decisions (defaults locked in)

1. RSA-OAEP only in v1 (ECDH forward secrecy = stretch).
2. Text-only tips v1 (attachments = stretch, Session 5 or later).
3. Reply channel is in scope (core to UX).
4. All three relays hosted under one Vercel account for v1, disclosed honestly
   in the transparency panel. Stretch: swap one node to a teammate for the demo.

## Working style for future sessions

- Read this file first, not the original HTML prototype — the React port
  supersedes it.
- Each session keeps edits within one or two top-level directories.
- No speculative abstractions. No comments explaining what the code does;
  only why, if non-obvious.
- Fonts load via `<link>` in `app/layout.tsx`; migrate to `next/font/google`
  only if we see a layout-shift problem.
