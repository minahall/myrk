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

## Status

- [x] Landing page + interactive circuit visualization
- [ ] Crypto primitives (Web Crypto API)
- [ ] Source submission → 3 relays → journalist dropbox
- [ ] Journalist dashboard
- [ ] Reply channel by codename
- [ ] Deploy (3 relay projects + frontend) on Vercel

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for design tokens, directory map, crypto API
shape, and session plan. Database schema lives in
[`supabase/schema.sql`](./supabase/schema.sql).
