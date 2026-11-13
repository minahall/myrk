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
lib/                  (Session 2+) crypto, Supabase client
  crypto/             rsa.ts, aes.ts, onion.ts, codename.ts, padding.ts
supabase/
  schema.sql          Database + RLS policies
```

## Supabase schema (full SQL in `supabase/schema.sql`)

- `nodes(id text pk, public_key jsonb, status text)` — public read.
- `journalists(id uuid pk, name text, public_key jsonb)` — public read.
- `tips(id, ciphertext bytea, wrapped_key bytea, iv bytea, created_at, read_at)`
  - Insert: service_role only (Node C). Select: authenticated journalist.
- `replies(id, mailbox_id text, ciphertext bytea, iv bytea, created_at)`
  - Insert: authenticated journalist. Select by `mailbox_id`: public
    (the hash itself is the capability).

## Planned crypto API (Session 2)

```ts
// lib/crypto/rsa.ts
generateRsaKeyPair(): Promise<CryptoKeyPair>
exportPublicJwk(key: CryptoKey): Promise<JsonWebKey>
importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey>

// lib/crypto/aes.ts
encryptAesGcm(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array>
decryptAesGcm(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array>

// lib/crypto/onion.ts
type Hop = { nodeId: string; publicKey: JsonWebKey };
wrapOnion(payload: Uint8Array, journalistKey: JsonWebKey, hops: Hop[]): Promise<Uint8Array>
peelOnion(layered: Uint8Array, privateKey: CryptoKey): Promise<{ next: Uint8Array; forwardTo?: string }>

// lib/crypto/codename.ts
generateCodename(wordCount?: number): string
deriveMailbox(codename: string): Promise<{ mailboxId: string; replyKey: CryptoKey }>
```

Fixed-size cells: `lib/crypto/padding.ts` pads every layered packet to a
constant size (e.g. 4 KiB) before transmission.

## Environment variables

```
# Frontend (Vercel: frontend project)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Each relay's own private key — set ONLY on that relay's Vercel project.
NODE_A_PRIVATE_KEY   # JWK JSON (RSA-OAEP private)
NODE_B_PRIVATE_KEY
NODE_C_PRIVATE_KEY

# ONLY Node C — writes to tips table.
SUPABASE_SERVICE_ROLE_KEY
```

## Session progression

- **S1 ✓** Scaffold + design port + schema file.
- **S2** `lib/crypto/*` primitives + roundtrip test page.
- **S3** Source submission flow (`/send`): wrap + POST to Node A.
- **S4** Three relay API routes (`/api/node-a|b|c`), key in env, no payload logs.
- **S5** Journalist dashboard: login, local key management, inbox decrypt, reply.
- **S6** Reply retrieval + wire adversary mode to real packet state.
- **S7** Split relays into separate Vercel projects, rate limit, README + threat model PDF.

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
