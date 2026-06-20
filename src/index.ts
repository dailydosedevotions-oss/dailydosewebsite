export interface Env {
  APP_TIME_ZONE?: string;
  BREVO_API_KEY: string;
  BREVO_LIST_ID: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  NOTIFY_EMAIL?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  GITHUB_DEVOTION_PATH_TEMPLATE?: string;
  GITHUB_TOKEN?: string;
  SITE_URL?: string;
  SENT_DEVOTIONS?: KVNamespace;
}

type Devotion = {
  title: string;
  scripture?: string;
  body: string;
  prayer?: string;
  url?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      return subscribe(request, env);
    }

    if (request.method === "POST" && url.pathname === "/send-today") {
      const result = await sendToday(env, { force: true });
      return corsResponse(JSON.stringify(result), 200, "application/json");
    }

    return corsResponse("Daily Dose Devotions mailer is running.", 200);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendToday(env));
  }
};

async function subscribe(request: Request, env: Env): Promise<Response> {
  let input: { email?: unknown; name?: unknown };

  try {
    input = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON body." }), 400, "application/json");
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!isEmail(email)) {
    return corsResponse(JSON.stringify({ error: "Please enter a valid email address." }), 400, "application/json");
  }

  const brevoResponse = await brevoFetch(env, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      attributes: name ? { FIRSTNAME: name } : undefined,
      listIds: [Number(env.BREVO_LIST_ID)],
      updateEnabled: true
    })
  });

  if (!brevoResponse.ok) {
    return brevoErrorResponse(brevoResponse);
  }

  return corsResponse(JSON.stringify({ ok: true }), 200, "application/json");
}

async function sendToday(env: Env, options: { force?: boolean } = {}) {
  const local = getLocalParts(env.APP_TIME_ZONE ?? "Europe/Dublin");

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

async function getDevotionFromGitHub(env: Env, date: string): Promise<Devotion> {
  const owner = env.GITHUB_OWNER ?? "dailydosedevotions-oss";
  const repo = env.GITHUB_REPO ?? "dailydosewebsite";
  const branch = env.GITHUB_BRANCH ?? "main";
  const template = env.GITHUB_DEVOTION_PATH_TEMPLATE ?? "devotions/{date}.json";
  const path = template.replaceAll("{date}", date);
  const apiUrl = new URL(`/repos/${owner}/${repo}/contents/${path}`, "https://api.github.com");
  apiUrl.searchParams.set("ref", branch);

  const headers: HeadersInit = {
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

  const devotion = (await response.json()) as Devotion;

  if (!devotion.title || !devotion.body) {
    throw new Error(`Devotion ${path} must include at least "title" and "body".`);
  }

  return devotion;
}

async function sendDevotionCampaign(env: Env, devotion: Devotion, date: string): Promise<void> {
  const html = renderDevotionHtml(env, devotion, date);
  const text = renderDevotionText(env, devotion, date);
  const senderEmail = getSenderEmail(env);

  const createResponse = await brevoFetch(env, "/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: `Daily Dose Devotion ${date}`,
      subject: devotion.title,
      sender: {
        name: env.BREVO_SENDER_NAME ?? "Daily Dose Devotions",
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

  const created = (await createResponse.json()) as { id: number };

  const sendResponse = await brevoFetch(env, `/emailCampaigns/${created.id}/sendNow`, {
    method: "POST"
  });

  if (!sendResponse.ok) {
    throw new Error(`Brevo campaign send failed: ${sendResponse.status} ${await sendResponse.text()}`);
  }
}

function renderDevotionHtml(env: Env, devotion: Devotion, date: string): string {
  const devotionUrl = devotion.url ?? `${getSiteUrl(env)}/devotions/${date}`;
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

function renderDevotionText(env: Env, devotion: Devotion, date: string): string {
  const devotionUrl = devotion.url ?? `${getSiteUrl(env)}/devotions/${date}`;

  return [
    `Daily Dose Devotions - ${date}`,
    devotion.title,
    devotion.scripture,
    devotion.body,
    devotion.prayer ? `Prayer\n${devotion.prayer}` : undefined,
    `Read on the website: ${devotionUrl}`
  ].filter(Boolean).join("\n\n");
}

async function brevoFetch(env: Env, path: string, init: RequestInit): Promise<Response> {
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

async function brevoErrorResponse(response: Response): Promise<Response> {
  const body = await response.text();
  return corsResponse(JSON.stringify({ error: "Brevo request failed.", status: response.status, details: body }), 502, "application/json");
}

function getSenderEmail(env: Env): string {
  const senderEmail = env.BREVO_SENDER_EMAIL ?? env.NOTIFY_EMAIL;

  if (!senderEmail) {
    throw new Error("Set BREVO_SENDER_EMAIL or NOTIFY_EMAIL in Cloudflare variables.");
  }

  return senderEmail;
}

function getSiteUrl(env: Env): string {
  return (env.SITE_URL ?? "https://yourdomain.com").replace(/\/$/, "");
}

function getLocalParts(timeZone: string): { date: string; hour: number } {
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

function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function corsResponse(body: BodyInit | null, status = 200, contentType = "text/plain"): Response {
  return new Response(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": contentType
    }
  });
}
