# Daily Dose Devotions: Cloudflare + Brevo + GitHub

This Cloudflare Worker:

- accepts new subscribers at `POST /subscribe`;
- adds them to Brevo list `2`;
- checks every hour and sends the devotion once when the local time in `Europe/Dublin` is 7am;
- loads each devotion from GitHub;
- creates and sends a Brevo email campaign to your subscriber list.

New subscribers are added to Brevo and will receive the next devotion release. They are not sent old devotions automatically.

## Existing Cloudflare variables

Your Cloudflare project already has:

```txt
BREVO_API_KEY = secret/encrypted
BREVO_LIST_ID = 2
NOTIFY_EMAIL = dailydosedevotions@gmail.com
```

The Worker uses `NOTIFY_EMAIL` as the sender email unless you add a separate `BREVO_SENDER_EMAIL` variable.

## Still needed

Set this Cloudflare plaintext variable to your real website address:

```txt
SITE_URL = https://your-real-website-domain.com
```

Optional variables:

```txt
BREVO_SENDER_NAME = Daily Dose Devotions
APP_TIME_ZONE = Europe/Dublin
GITHUB_OWNER = dailydosedevotions-oss
GITHUB_REPO = dailydosewebsite
GITHUB_BRANCH = main
GITHUB_DEVOTION_PATH_TEMPLATE = devotions/{date}.json
```

Optional anti-duplicate protection:

```txt
SENT_DEVOTIONS
```

This is a Cloudflare KV binding. The Worker can run without it, but adding it protects against accidental duplicate sends.

## Devotion file format

Create one JSON file per day in GitHub.

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
