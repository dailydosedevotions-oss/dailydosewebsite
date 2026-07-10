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
  "107": "2026-08-09T06:00:00Z",
  "108": "2026-08-10T06:00:00Z",
  "109": "2026-08-11T06:00:00Z",
  "110": "2026-08-12T06:00:00Z",
  "111": "2026-08-13T06:00:00Z",
  "112": "2026-08-14T06:00:00Z",
  "113": "2026-08-15T06:00:00Z",
  "114": "2026-08-16T06:00:00Z",
  "115": "2026-08-17T06:00:00Z",
  "116": "2026-08-18T06:00:00Z",
  "117": "2026-08-19T06:00:00Z",
  "118": "2026-08-20T06:00:00Z",
  "119": "2026-08-21T06:00:00Z",
  "120": "2026-08-22T06:00:00Z",
  "121": "2026-08-23T06:00:00Z",
  "122": "2026-08-24T06:00:00Z",
  "123": "2026-08-25T06:00:00Z",
  "124": "2026-08-26T06:00:00Z",
  "125": "2026-08-27T06:00:00Z",
  "126": "2026-08-28T06:00:00Z",
  "127": "2026-08-29T06:00:00Z",
  "128": "2026-08-30T06:00:00Z",
  "129": "2026-08-31T06:00:00Z",
  "130": "2026-09-01T06:00:00Z",
  "131": "2026-09-02T06:00:00Z",
  "132": "2026-09-03T06:00:00Z",
  "133": "2026-09-04T06:00:00Z",
  "134": "2026-09-05T06:00:00Z",
  "135": "2026-09-06T06:00:00Z",
  "136": "2026-09-07T06:00:00Z",
  "137": "2026-09-08T06:00:00Z",
  "138": "2026-09-09T06:00:00Z",
  "139": "2026-09-10T06:00:00Z",
  "140": "2026-09-11T06:00:00Z",
  "141": "2026-09-12T06:00:00Z",
  "142": "2026-09-13T06:00:00Z",
  "143": "2026-09-14T06:00:00Z",
  "144": "2026-09-15T06:00:00Z",
  "145": "2026-09-16T06:00:00Z",
  "146": "2026-09-17T06:00:00Z",
  "147": "2026-09-18T06:00:00Z",
  "148": "2026-09-19T06:00:00Z"
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

const blessedAreSchedule = {
  "1": "2026-08-23T18:00:00Z",
  "2": "2026-08-30T18:00:00Z",
  "3": "2026-09-06T18:00:00Z",
  "4": "2026-09-13T18:00:00Z",
  "5": "2026-09-20T18:00:00Z",
  "6": "2026-09-27T18:00:00Z",
  "7": "2026-10-04T18:00:00Z",
  "8": "2026-10-11T18:00:00Z",
  "9": "2026-10-18T18:00:00Z"
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

  const blessedAreMatch = url.pathname.match(/^\/series\/blessed-are-part-(\d+)\.html$/);
  if (blessedAreMatch && blessedAreSchedule[blessedAreMatch[1]]) {
    const publishAt = new Date(blessedAreSchedule[blessedAreMatch[1]]);
    if (now < publishAt) {
      return scheduledResponse('Daily Dose: Blessed Are', 'Scheduled Series Part', 'This Blessed Are part is scheduled and will become available at 7pm on its Sunday release date.', '/series/blessed-are.html', 'Back to Blessed Are');
    }
  }

  return context.next();
}
