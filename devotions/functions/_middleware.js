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
  "61": "2026-06-24T06:00:00Z",
  "62": "2026-06-25T06:00:00Z",
  "63": "2026-06-26T06:00:00Z",
  "64": "2026-06-27T06:00:00Z",
  "65": "2026-06-28T06:00:00Z",
  "66": "2026-06-29T06:00:00Z",
  "67": "2026-06-30T06:00:00Z",
  "68": "2026-07-01T06:00:00Z",
  "69": "2026-07-02T06:00:00Z",
  "70": "2026-07-03T06:00:00Z",
  "71": "2026-07-04T06:00:00Z",
  "72": "2026-07-05T06:00:00Z",
  "73": "2026-07-06T06:00:00Z",
  "74": "2026-07-07T06:00:00Z",
  "75": "2026-07-08T06:00:00Z",
  "76": "2026-07-09T06:00:00Z",
  "77": "2026-07-10T06:00:00Z",
  "78": "2026-07-11T06:00:00Z",
  "79": "2026-07-12T06:00:00Z",
  "80": "2026-07-13T06:00:00Z",
  "81": "2026-07-14T06:00:00Z",
  "82": "2026-07-15T06:00:00Z",
  "83": "2026-07-16T06:00:00Z",
  "84": "2026-07-17T06:00:00Z",
  "85": "2026-07-18T06:00:00Z",
  "86": "2026-07-19T06:00:00Z",
  "87": "2026-07-20T06:00:00Z",
  "88": "2026-07-21T06:00:00Z",
  "89": "2026-07-22T06:00:00Z",
  "90": "2026-07-23T06:00:00Z",
  "91": "2026-07-24T06:00:00Z",
  "92": "2026-07-25T06:00:00Z"
};

const formedSchedule = {
  "1": "2026-06-07T18:00:00Z",
  "2": "2026-06-14T18:00:00Z",
  "3": "2026-06-21T18:00:00Z",
  "4": "2026-06-28T18:00:00Z",
  "5": "2026-07-05T18:00:00Z",
  "6": "2026-07-12T18:00:00Z",
  "7": "2026-07-19T18:00:00Z",
  "8": "2026-07-26T18:00:00Z"
};

function scheduledResponse(eyebrow, title, message, backHref, backText) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><link rel="stylesheet" href="/styles.css"></head><body><main class="devotion-shell"><div class="container"><article class="devotion-article reveal visible"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${message}</p><p><a class="btn primary small" href="${backHref}">${backText}</a></p></article></div></main></body></html>`, {
    status: 403,
    headers: { 'content-type': 'text/html; charset=UTF-8' }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const now = new Date();

  const devotionMatch = url.pathname.match(/^\/devotions\/daily-dose-(\d+)\.html$/);
  if (devotionMatch && schedule[devotionMatch[1]]) {
    const publishAt = new Date(schedule[devotionMatch[1]]);
    if (now < publishAt) {
      return scheduledResponse('Daily Dose', 'Scheduled Devotion', 'This devotion is scheduled and will become available at 7am on its release date.', '/devotions.html', 'Back to Devotions');
    }
  }

  const formedMatch = url.pathname.match(/^\/series\/formed-part-(\d+)\.html$/);
  if (formedMatch && formedSchedule[formedMatch[1]]) {
    const publishAt = new Date(formedSchedule[formedMatch[1]]);
    if (now < publishAt) {
      return scheduledResponse('Daily Dose: FORMED', 'Scheduled Series Part', 'This FORMED part is scheduled and will become available at 7pm on its Sunday release date.', '/series.html', 'Back to FORMED');
    }
  }

  return context.next();
}
