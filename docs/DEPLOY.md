# Deploying Group Canvas

**Route: GitHub Actions + Cloudflare API token** (`.github/workflows/deploy.yml`).
Added by Claude, 2026-10-16, at Timothy's request.

## Why not the dashboard's "Connect GitHub"

On 2026-10-16 the dashboard flow failed with *"Error connecting to git account — Cloudflare
Pages was unable to be installed on your GitHub account."* Findings:

- The GitHub app "Cloudflare Workers and Pages" was installed on Timothy's GitHub account
  about four months earlier, but this Cloudflare account showed GitHub as not connected.
  Cloudflare's docs state that a GitHub account should point to only one Cloudflare
  account, and their fix for this error is uninstall → reinstall.
- **None of Timothy's Workers use that app.** `echo-green-future` deploys from
  `Echo_Green_Future/.github/workflows/deploy.yml` with `cloudflare/wrangler-action@v3`
  and repository secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. That route is
  already proven on this account, so Group Canvas uses the same one.
- Cloudflare's docs list no mobile-specific bug. The app install bounces through a
  separate GitHub tab, which phone browsers handle unreliably; the Actions route has no
  such step.

## One-time setup (all in a phone browser)

1. **Cloudflare API token:** dashboard → profile/account → **API Tokens** → **Create Token**
   → template **Edit Cloudflare Workers** → account: Timothy's account → create → copy it.
   (Or reuse the token already used for Echo_Green_Future, if its value is still saved
   somewhere. GitHub can't show a saved secret's value.)
2. **Account ID:** dashboard → **Workers & Pages** → shown on the right side ("Account ID").
3. **GitHub:** `Group_Canvas` → **Settings → Secrets and variables → Actions → New
   repository secret**, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `ROOM_SIGNING_KEY` — 32+ random characters
   - `CREATE_ROOM_KEY` — 24+ random characters; only people with it can create rooms
4. **Run it:** `Group_Canvas` → **Actions** → **Deploy to Cloudflare** → **Run workflow**.
   After that, every push to `main` deploys automatically.

The workflow runs the test suite first and deploys only if it passes. Without the two
Cloudflare secrets, the deploy job skips with a warning instead of failing.

## Note for Codex

Please review `.github/workflows/deploy.yml`. Points to check:
- Runtime secrets are uploaded with `wrangler secret put` after `wrangler deploy`, so the
  very first deploy runs briefly without them.
- Paid providers stay disabled unless `ALLOW_PAID_PROVIDERS = "true"` is set as a Worker
  var and provider keys are added; this workflow doesn't touch either.
- Real Cloudflare execution of the Durable Object is still unverified until the first run.
