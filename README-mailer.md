# Daily Dose Devotions: Cloudflare + Brevo + GitHub

This Cloudflare Worker:

- accepts new subscribers at `POST /subscribe`;
- adds them to a Brevo contact list;
- checks every hour and sends the devotion once when the local time in `APP_TIME_ZONE` is 7am;
- loads each devotion from GitHub;
- creates and sends a Brevo email campaign to your subscriber list.

## Devotion file format

Create one JSON file per day in your GitHub repo.

Example: `devotions/2026-06-20.json`

```json
{
  "title": "Strength for Today",
  "scripture": "Psalm 46:1",
  "body": "God is our refuge and strength...\n\nA second paragraph can go here.",
  "prayer": "Lord, help me trust You today.",
  "url": "https://yourdomain.com/devotions/2026-06-20"
}
```

Only `title` and `body` are required.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Cloudflare KV namespace:

   ```bash
   npx wrangler kv namespace create SENT_DEVOTIONS
   ```

   Put the returned namespace ID into `wrangler.toml`.

3. Edit `wrangler.toml` and replace:

   - `BREVO_LIST_ID`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH`
   - `GITHUB_DEVOTION_PATH_TEMPLATE`
   - `SITE_URL`

4. Add secrets:

   ```bash
   npx wrangler secret put BREVO_API_KEY
   npx wrangler secret put GITHUB_TOKEN
   ```

   `GITHUB_TOKEN` is needed for a private repo. If your devotion repo is public, you can remove `GITHUB_TOKEN` from the Worker.

5. Deploy:

   ```bash
   npm run deploy
   ```

## Website subscribe form

Point your form to:

```txt
https://your-worker.your-subdomain.workers.dev/subscribe
```

Send JSON:

```json
{
  "email": "subscriber@example.com",
  "name": "Sarah"
}
```

## Manual test send

After deployment, you can trigger today's send manually:

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/send-today
```

Use that carefully because it sends to the Brevo list.
