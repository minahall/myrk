# MYRK

Anonymous whistleblowing demo with 3-relay onion routing.
CS 3002 Information Security — term project.

Send a tip through three relays that each know only a third of the story. Only
the journalist can read it. Reply back by codename, without an account.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Create `.env.local` from `.env.example`. For local dev put every variable in
one file; one `npm run dev` process acts as every relay.

First-time bootstrap (once per Supabase project):

1. Paste `supabase/schema.sql` into Supabase SQL editor and run.
2. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, restart dev.
3. Visit `/admin/keys`, click **Generate all keys**.
4. Run both SQL snippets back in Supabase to populate `nodes` and `journalists`.
5. Paste the 3 node private JWKs into `.env.local` as `NODE_A_PRIVATE_KEY`,
   `NODE_B_PRIVATE_KEY`, `NODE_C_PRIVATE_KEY` (each a one-line JSON string).
6. Add `SUPABASE_SERVICE_ROLE_KEY` from Supabase Project Settings → API (keep secret).
7. Save the journalist's private JWK as a file — needed for the Session 5 dashboard.
8. Restart dev. `/send` should now deliver tips end-to-end through all 3 relays into the `tips` table.

### Journalist account (one-time)

In the Supabase dashboard → **Authentication → Users → Add user**:

- Email: anything (e.g. `journalist@example.com`)
- Password: strong password of your choice
- Tick **Auto Confirm User**

The journalist then visits `/dashboard`, signs in with those credentials, and
uploads the private JWK file saved from `/admin/keys`. The JWK is sealed in
their browser's localStorage with a passphrase of their choice. On later
visits they just enter the passphrase to unlock.

## Status

- [x] Landing page + interactive circuit visualization (real ephemeral crypto)
- [x] Crypto primitives (Web Crypto API) — see `/test`
- [x] Source submission → 3 relays → journalist dropbox — see `/send`
- [x] Journalist dashboard — see `/dashboard`
- [x] Reply channel by codename — see `/reply`
- [x] Rate-limited entry relay + per-role route gating via `middleware.ts`
- [x] Deployment guide (`DEPLOY.md`) for four Vercel projects
- [x] Threat model (`THREAT-MODEL.md`)

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for design tokens, directory map, crypto API
shape, and session plan. Database schema lives in
[`supabase/schema.sql`](./supabase/schema.sql).
