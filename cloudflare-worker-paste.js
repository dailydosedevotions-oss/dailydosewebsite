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
          message: "Add ?confirm=SEND to send today's devotion to the Brevo list.",
          sendUrl: `${url.origin}${url.pathname}?confirm=SEND`
        }, 400);
      }

      const result = await sendToday(env, { force: true });
      return json(result);
    }

    return json({
      ok: true,
      message: "Daily Dose Auto Email Worker is live",
      check: "/check",
      sendNow: "/send-daily-now?confirm=SEND"
    });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendToday(env));
  }
};

async function checkToday(env) {
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin");

  try {
    const devotion = await getDevotionFromGitHub(env, local.date);
    return json({
      ok: true,
      worker: "Daily Dose Auto Email Worker is live",
      date: local.date,
      latestDailyDose: {
        title: devotion.title,
        scripture: devotion.scripture || null,
        url: devotion.url || `${getSiteUrl(env)}/devotions/${local.date}`
      }
    });
  } catch (error) {
    return json({
      ok: false,
      worker: "Daily Dose Auto Email Worker is live",
      date: local.date,
      latestDailyDose: null,
      error: String(error && error.message ? error.message : error)
    }, 500);
  }
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

async function sendToday(env, options = {}) {
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin");

  if (!options.force && local.hour !== 7) {
    return { skipped: true, reason: `Local hour is ${local.hour}, not 7.`, date: local.date };
  }

  const sentKey = `sent:${local.date}`;

  if (env.SENT_DEVOTIONS) {
    const existing = await env.SENT_DEVOTIONS.get(sentKey);

    if (existing && !options.force) {
      return { skipped: true, reason: "Already sent today.", date: local.date };
    }
  }

  const devotion = await getDevotionFromGitHub(env, local.date);
  await sendDevotionCampaign(env, devotion, local.date);

  if (env.SENT_DEVOTIONS) {
    await env.SENT_DEVOTIONS.put(sentKey, new Date().toISOString());
  }

  return { ok: true, date: local.date, title: devotion.title };
}

async function getDevotionFromGitHub(env, date) {
  const owner = env.GITHUB_OWNER || "dailydosedevotions-oss";
  const repo = env.GITHUB_REPO || "dailydosewebsite";
  const branch = env.GITHUB_BRANCH || "main";
  const template = env.GITHUB_DEVOTION_PATH_TEMPLATE || "devotions/{date}.json";
  const path = template.replaceAll("{date}", date);
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

async function sendDevotionCampaign(env, devotion, date) {
  const html = renderDevotionHtml(env, devotion, date);
  const text = renderDevotionText(env, devotion, date);
  const senderEmail = env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL;

  if (!senderEmail) {
    throw new Error("Set BREVO_SENDER_EMAIL or NOTIFY_EMAIL in Cloudflare variables.");
  }

  const createResponse = await brevoFetch(env, "/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: `Daily Dose Devotion ${date}`,
      subject: devotion.title,
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

function renderDevotionHtml(env, devotion, date) {
  const devotionUrl = devotion.url || `${getSiteUrl(env)}/devotions/${date}`;
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

function renderDevotionText(env, devotion, date) {
  const devotionUrl = devotion.url || `${getSiteUrl(env)}/devotions/${date}`;

  return [
    `Daily Dose Devotions - ${date}`,
    devotion.title,
    devotion.scripture,
    devotion.body,
    devotion.prayer ? `Prayer\n${devotion.prayer}` : undefined,
    `Read on the website: ${devotionUrl}`
  ].filter(Boolean).join("\n\n");
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

function getLocalParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour)
  };
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
