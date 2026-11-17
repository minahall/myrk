# Deploying MYRK to Vercel

Four Vercel projects, all pointing at the same GitHub repo on the same branch.
The code is identical in every project — only the **environment variables**
differ. A `middleware.ts` at the repo root uses `NODE_ROLE` to hide the API
routes that don't belong to that deployment.

## 0. Prerequisites

- GitHub repo pushed with the current code.
- Supabase project already bootstrapped (`schema.sql` run; `nodes` + `journalists` seeded via `/admin/keys`).
- Your 3 node private JWKs and 1 journalist private JWK saved as files on disk.

## 1. Create four Vercel projects

For each of the four projects: **New Project → Import** your GitHub repo.
Leave the framework preset (Next.js) alone. **Don't deploy yet** — set env
vars first.

Suggested names:

| Project         | Purpose                           |
| --------------- | --------------------------------- |
| `myrk`          | Frontend (landing, /send, /reply, /dashboard) |
| `myrk-node-a`   | Entry relay                       |
| `myrk-node-b`   | Middle relay                      |
| `myrk-node-c`   | Exit relay                        |

## 2. Set environment variables per project

Under each project → **Settings → Environment Variables**. Apply to *Production* and *Preview*.

### `myrk` (frontend)
```
NODE_ROLE=frontend
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_NODE_A_URL=                        # set in step 4 once Node A is deployed
```

### `myrk-node-a`
```
NODE_ROLE=a
NODE_A_PRIVATE_KEY={"kty":"RSA","n":"…",…}      # one-line JSON
NODE_B_URL=                                     # set in step 4 once Node B is deployed
ALLOWED_ORIGIN=                                 # set in step 4 to the frontend URL
SEND_LIMIT_PER_MIN=10                           # optional, default 10
```

### `myrk-node-b`
```
NODE_ROLE=b
NODE_B_PRIVATE_KEY={"kty":"RSA","n":"…",…}
NODE_C_URL=                                     # set in step 4 once Node C is deployed
```

### `myrk-node-c`
```
NODE_ROLE=c
NODE_C_PRIVATE_KEY={"kty":"RSA","n":"…",…}
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...         # DANGEROUS — this is only here
```

## 3. First deploy (any order)

Click **Deploy** on each project. They'll all build successfully — the
middleware just hides the wrong routes depending on `NODE_ROLE`. After each
deploy, write down the resulting Production URL. You should have four URLs,
e.g.:

```
Frontend:  https://myrk.vercel.app
Node A:    https://myrk-node-a.vercel.app
Node B:    https://myrk-node-b.vercel.app
Node C:    https://myrk-node-c.vercel.app
```

## 4. Cross-link the URLs

Fill in the placeholders left in step 2:

- On **myrk**: `NEXT_PUBLIC_NODE_A_URL = https://myrk-node-a.vercel.app/api/node-a`
- On **myrk-node-a**: `NODE_B_URL = https://myrk-node-b.vercel.app/api/node-b`,
  `ALLOWED_ORIGIN = https://myrk.vercel.app`
- On **myrk-node-b**: `NODE_C_URL = https://myrk-node-c.vercel.app/api/node-c`

Then **Redeploy** each of those three projects (Vercel → project → Deployments
→ ⋯ → Redeploy latest with the new env).

## 5. Smoke test

1. Visit `https://myrk.vercel.app` → landing page loads.
2. `/send` → write a tip → Send. Status should flow through "Looking up relay
   keys" → "Wrapping" → "Sending" → "Delivered." with a codename.
3. Check Supabase `tips` table → new row.
4. `/dashboard` → sign in → unlock → the tip appears decrypted.
5. Reply.
6. In a fresh tab, `/reply` → paste the codename → reply decrypts.

If **Send** returns a CORS error, double-check `ALLOWED_ORIGIN` on `myrk-node-a`
is set to your exact frontend URL (no trailing slash).

If **Node B rejected** style error appears, open the Node A project's
**Logs** tab in Vercel to see the forward-failure stack. Usually a wrong
`NODE_B_URL` or a mis-pasted private JWK on Node B.

## 6. Hardening before the demo

- Flip all four deployments to **Production** branch protection so pushes to
  `main` auto-redeploy.
- Rotate the journalist account's password and update `/dashboard` sign-in.
- Verify `/admin/keys` is still reachable (it's a dev tool but it doesn't
  publish anything — all crypto is browser-local). If you want to hide it in
  production, add `basicAuth` middleware or remove the route before the final
  deploy.
- Lower `SEND_LIMIT_PER_MIN` from 10 to e.g. 3 for the live demo if you expect
  grader abuse.

## 7. Independent operator for the demo (stretch goal)

Give one of the three node private JWKs to a teammate and have them deploy
`myrk-node-b` (or `-c`) under *their* Vercel account. Update `NODE_B_URL` /
`NODE_C_URL` on the upstream relay accordingly. Nothing else changes — the
threat model's "separate trust domains" claim is now literally true for one
hop, and you can demonstrate it live in the transparency panel.
