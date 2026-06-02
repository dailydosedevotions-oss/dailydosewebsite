const schedule = {
  "40": "2026-06-03T06:00:00Z",
  "41": "2026-06-04T06:00:00Z",
  "42": "2026-06-05T06:00:00Z",
  "43": "2026-06-06T06:00:00Z",
  "44": "2026-06-07T06:00:00Z",
  "45": "2026-06-08T06:00:00Z",
  "46": "2026-06-09T06:00:00Z",
  "47": "2026-06-10T06:00:00Z",
  "48": "2026-06-11T06:00:00Z",
  "49": "2026-06-12T06:00:00Z",
  "50": "2026-06-13T06:00:00Z",
  "51": "2026-06-14T06:00:00Z",
  "52": "2026-06-15T06:00:00Z",
  "53": "2026-06-16T06:00:00Z",
  "54": "2026-06-17T06:00:00Z",
  "55": "2026-06-18T06:00:00Z",
  "56": "2026-06-19T06:00:00Z",
  "57": "2026-06-20T06:00:00Z",
  "58": "2026-06-21T06:00:00Z",
  "59": "2026-06-22T06:00:00Z",
  "60": "2026-06-23T06:00:00Z",
  "61": "2026-06-24T06:00:00Z"
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const match = url.pathname.match(/^\/devotions\/daily-dose-(\d+)\.html$/);
  if (match && schedule[match[1]]) {
    const now = new Date();
    const publishAt = new Date(schedule[match[1]]);
    if (now < publishAt) {
      return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Scheduled Devotion</title><link rel="stylesheet" href="/styles.css"></head><body><main class="devotion-shell"><div class="container"><article class="devotion-article reveal visible"><p class="eyebrow">Daily Dose</p><h1>Scheduled Devotion</h1><p>This devotion is scheduled and will become available at 7am on its release date.</p><p><a class="btn primary small" href="/devotions.html">Back to Devotions</a></p></article></div></main></body></html>`, {
        status: 403,
        headers: { 'content-type': 'text/html; charset=UTF-8' }
      });
    }
  }
  return context.next();
}
