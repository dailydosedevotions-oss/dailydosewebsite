# dailydosewebsite
Official Daily Dose Devotions website and scheduled Scripture reflections .

## Private PWA install stats

PWA install/activity counts are stored through `/api/pwa-stats`. Browser tracking uses `POST` requests, but reading the totals with `GET` is private.

Set a Cloudflare Pages environment variable named `PWA_STATS_TOKEN`, then view stats with:

`https://dailydosedevotions.ie/api/pwa-stats?token=YOUR_PRIVATE_TOKEN`

Or use the private dashboard:

`https://dailydosedevotions.ie/pwa-stats.html?token=YOUR_PRIVATE_TOKEN`

Do not share that token publicly.
