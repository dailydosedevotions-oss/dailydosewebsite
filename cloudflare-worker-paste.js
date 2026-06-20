export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json(null, 204);
    }

    if (url.pathname === "/check") {
      return checkToday(env);
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      return subscribe(request, env);
    }

    if (url.pathname === "/send-daily-now" || url.pathname === "/send-today") {
      if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
        return json({
          ok: false,
          message: "Add ?confirm=SEND to send only today's daily devotion to the Brevo list.",
          sendUrl: `${url.origin}${url.pathname}?confirm=SEND`
        }, 400);
      }

      const result = await sendManualDaily(env);
      return json(result);
    }

    if (url.pathname === "/send-due-now") {
      if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
        return json({
          ok: false,
          message: "Add ?confirm=SEND to send all currently due daily/series devotions.",
          sendUrl: `${url.origin}${url.pathname}?confirm=SEND`
        }, 400);
      }

      const result = await sendDueDevotions(env, { manual: true });
      return json(result);
    }

    return json({
      ok: true,
      message: "Daily Dose Auto Email Worker is live",
      check: "/check",
      sendTodayOnly: "/send-daily-now?confirm=SEND",
      sendAllDue: "/send-due-now?confirm=SEND"
    });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDueDevotions(env));
  }
};

async function checkToday(env) {
  const now = new Date();
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", now);
  const candidates = await loadTodayCandidates(env, local.date);

  return json({
    ok: true,
    worker: "Daily Dose Auto Email Worker is live",
    date: local.date,
    localTime: local.time,
    latestDailyDose: summarizeCandidate(candidates.find((candidate) => candidate.collection === "daily"), now),
    latestSeriesDose: summarizeCandidate(candidates.find((candidate) => candidate.collection === "series"), now),
    note: "Scheduled sends only happen when a devotion is due and has not already been sent."
  });
}

async function subscribe(request, env) {
  let input;

  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!isEmail(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const response = await brevoFetch(env, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      attributes: name ? { FIRSTNAME: name } : undefined,
      listIds: [Number(env.BREVO_LIST_ID)],
      updateEnabled: true
    })
  });

  if (!response.ok) {
    return brevoError(response);
  }

  return json({ ok: true });
}

async function sendManualDaily(env) {
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", new Date());
  const daily = await loadDevotionCandidate(env, "daily", local.date);

  if (!daily) {
    return { ok: false, date: local.date, message: "No daily devotion file found for today." };
  }

  await sendDevotionCampaign(env, daily);
  await markSent(env, daily);

  return {
    ok: true,
    sent: [{ collection: daily.collection, date: daily.date, title: daily.devotion.title }],
    note: "Only today's daily devotion was sent."
  };
}

async function sendDueDevotions(env, options = {}) {
  const now = new Date();
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", now);
  const candidates = await loadTodayCandidates(env, local.date);
  const sent = [];
  const skipped = [];

  for (const candidate of candidates) {
    if (!isDue(candidate, now)) {
      skipped.push({
        collection: candidate.collection,
        date: candidate.date,
        title: candidate.devotion.title,
        reason: "Not live yet",
        publishAt: getPublishAt(candidate).toISOString()
      });
      continue;
    }

    if (!options.manual && await wasSent(env, candidate)) {
      skipped.push({
        collection: candidate.collection,
        date: candidate.date,
        title: candidate.devotion.title,
        reason: "Already sent"
      });
      continue;
    }

    await sendDevotionCampaign(env, candidate);
    await markSent(env, candidate);
    sent.push({ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title });
  }

  return { ok: true, date: local.date, sent, skipped };
}

async function loadTodayCandidates(env, date) {
  const candidates = [];
  const daily = await loadDevotionCandidate(env, "daily", date);
  const series = await loadDevotionCandidate(env, "series", date);

  if (daily) candidates.push(daily);
  if (series) candidates.push(series);

  return candidates;
}

async function loadDevotionCandidate(env, collection, date) {
  const template = getPathTemplate(env, collection);

  if (!template) {
    return null;
  }

  const path = template.replaceAll("{date}", date);

  try {
    const devotion = await getDevotionFromGitHub(env, path);
    return { collection, date, path, devotion };
  } catch (error) {
    if (String(error && error.message ? error.message : error).includes("404")) {
      return null;
    }

    throw error;
  }
}

function getPathTemplate(env, collection) {
  if (collection === "daily") {
    return env.GITHUB_DAILY_DEVOTION_PATH_TEMPLATE || env.GITHUB_DEVOTION_PATH_TEMPLATE || "devotions/{date}.json";
  }

  return env.GITHUB_SERIES_DEVOTION_PATH_TEMPLATE || "series/{date}.json";
}

async function getDevotionFromGitHub(env, path) {
  const owner = env.GITHUB_OWNER || "dailydosedevotions-oss";
  const repo = env.GITHUB_REPO || "dailydosewebsite";
  const branch = env.GITHUB_BRANCH || "main";
  const apiUrl = new URL(`/repos/${owner}/${repo}/contents/${path}`, "https://api.github.com");
  apiUrl.searchParams.set("ref", branch);

  const headers = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "daily-dose-devotions-worker"
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error(`Could not load devotion ${path} from GitHub: ${response.status} ${await response.text()}`);
  }

  const devotion = await response.json();

  if (!devotion.title || !devotion.body) {
    throw new Error(`Devotion ${path} must include at least title and body.`);
  }

  return devotion;
}

async function sendDevotionCampaign(env, candidate) {
  const { devotion, date, collection } = candidate;
  const html = renderDevotionHtml(env, candidate);
  const text = renderDevotionText(env, candidate);
  const senderEmail = env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL;

  if (!senderEmail) {
    throw new Error("Set BREVO_SENDER_EMAIL or NOTIFY_EMAIL in Cloudflare variables.");
  }

  const createResponse = await brevoFetch(env, "/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: `Daily Dose ${collection} ${date}`,
      subject: devotion.emailSubject || devotion.title,
      sender: {
        name: env.BREVO_SENDER_NAME || "Daily Dose Devotions",
        email: senderEmail
      },
      type: "classic",
      htmlContent: html,
      textContent: text,
      recipients: {
        listIds: [Number(env.BREVO_LIST_ID)]
      }
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Brevo campaign create failed: ${createResponse.status} ${await createResponse.text()}`);
  }

  const created = await createResponse.json();
  const sendResponse = await brevoFetch(env, `/emailCampaigns/${created.id}/sendNow`, {
    method: "POST"
  });

  if (!sendResponse.ok) {
    throw new Error(`Brevo campaign send failed: ${sendResponse.status} ${await sendResponse.text()}`);
  }
}

function renderDevotionHtml(env, candidate) {
  const { devotion, date, collection } = candidate;
  const devotionUrl = devotion.url || `${getSiteUrl(env)}/${collection === "series" ? "series" : "devotions"}/${date}`;
  const paragraphs = devotion.body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f4ef;color:#202124;font-family:Arial,sans-serif;">
    <main style="max-width:640px;margin:0 auto;padding:32px 20px;background:#ffffff;">
      <p style="margin:0 0 8px;color:#6b6258;font-size:14px;">Daily Dose Devotions - ${escapeHtml(date)}</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">${escapeHtml(devotion.title)}</h1>
      ${devotion.scripture ? `<p style="font-weight:700;color:#365e53;">${escapeHtml(devotion.scripture)}</p>` : ""}
      <div style="font-size:17px;line-height:1.65;">${paragraphs}</div>
      ${devotion.prayer ? `<h2 style="font-size:20px;margin-top:28px;">Prayer</h2><p style="font-size:17px;line-height:1.65;">${escapeHtml(devotion.prayer)}</p>` : ""}
      <p style="margin-top:32px;"><a href="${escapeHtml(devotionUrl)}" style="color:#365e53;font-weight:700;">Read on the website</a></p>
    </main>
  </body>
</html>`;
}

function renderDevotionText(env, candidate) {
  const { devotion, date, collection } = candidate;
  const devotionUrl = devotion.url || `${getSiteUrl(env)}/${collection === "series" ? "series" : "devotions"}/${date}`;

  return [
    `Daily Dose Devotions - ${date}`,
    devotion.title,
    devotion.scripture,
    devotion.body,
    devotion.prayer ? `Prayer\n${devotion.prayer}` : undefined,
    `Read on the website: ${devotionUrl}`
  ].filter(Boolean).join("\n\n");
}

function summarizeCandidate(candidate, now) {
  if (!candidate) {
    return null;
  }

  const publishAt = getPublishAt(candidate);

  return {
    title: candidate.devotion.title,
    scripture: candidate.devotion.scripture || null,
    url: candidate.devotion.url || null,
    publishAt: publishAt.toISOString(),
    due: now >= publishAt
  };
}

function getPublishAt(candidate) {
  const configured = candidate.devotion.publishAt || candidate.devotion.releaseAt || candidate.devotion.liveAt;

  if (configured) {
    return new Date(configured);
  }

  return localDateTimeToUtc(candidate.date, "07:00", "Europe/Dublin");
}

function isDue(candidate, now) {
  const publishAt = getPublishAt(candidate);
  return Number.isFinite(publishAt.getTime()) && now >= publishAt;
}

async function wasSent(env, candidate) {
  const store = getSentStore(env);

  if (!store) {
    return false;
  }

  return Boolean(await store.get(sentKey(candidate)));
}

async function markSent(env, candidate) {
  const store = getSentStore(env);

  if (store) {
    await store.put(sentKey(candidate), new Date().toISOString());
  }
}

function getSentStore(env) {
  return env.SENT_DEVOTIONS || env.EMAIL_SENT_LOG || null;
}

function sentKey(candidate) {
  return `sent:${candidate.collection}:${candidate.path}`;
}

async function brevoFetch(env, path, init) {
  return fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
      ...init.headers
    }
  });
}

async function brevoError(response) {
  const body = await response.text();
  return json({ error: "Brevo request failed.", status: response.status, details: body }, 502);
}

function getSiteUrl(env) {
  return (env.SITE_URL || "https://dailydosedevotions.ie").replace(/\/$/, "");
}

function getLocalParts(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    hour: Number(values.hour)
  };
}

function localDateTimeToUtc(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const localParts = getLocalParts(timeZone, utcGuess);
  const offsetMinutes = (Number(localParts.hour) - hour) * 60 + (Number(localParts.time.slice(3, 5)) - minute);
  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data, null, 2), {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json"
    }
  });
}
