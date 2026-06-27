export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") return json(null, 204);
      if (url.pathname === "/check") return checkToday(env);
      if (url.pathname === "/preview-email") return previewEmail(env);
      if (url.pathname === "/preview-milestone-100") return previewMilestone100(env);
      if (url.pathname === "/subscribe" && request.method === "POST") return subscribe(request, env);

      if (url.pathname === "/send-daily-now" || url.pathname === "/send-today") {
        if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
          return json({ ok: false, message: "Add ?confirm=SEND to send only today's daily devotion.", sendUrl: `${url.origin}${url.pathname}?confirm=SEND` }, 400);
        }
        return json(await sendManualCollection(env, "daily", "Only today's daily devotion was sent."));
      }

      if (url.pathname === "/send-series-now") {
        if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
          return json({ ok: false, message: "Add ?confirm=SEND to send only today's series devotion.", sendUrl: `${url.origin}${url.pathname}?confirm=SEND` }, 400);
        }
        return json(await sendManualCollection(env, "series", "Only today's series devotion was sent."));
      }

      if (url.pathname === "/send-due-now") {
        if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
          return json({ ok: false, message: "Add ?confirm=SEND to send all currently due devotions.", sendUrl: `${url.origin}${url.pathname}?confirm=SEND` }, 400);
        }
        return json(await sendDueDevotions(env, { manual: true }));
      }

      if (url.pathname === "/send-milestone-100") {
        if (request.method === "GET" && url.searchParams.get("confirm") !== "SEND") {
          return json({ ok: false, message: "Add ?confirm=SEND to send the Daily Dose #100 thank-you email.", sendUrl: `${url.origin}${url.pathname}?confirm=SEND` }, 400);
        }
        return json(await sendMilestone100Email(env, { manual: true, force: url.searchParams.get("force") === "1" }));
      }

      return json({
        ok: true,
        message: "Daily Dose Auto Email Worker is live",
        check: "/check",
        previewEmail: "/preview-email",
        previewMilestone100: "/preview-milestone-100",
        sendTodayOnly: "/send-daily-now?confirm=SEND",
        sendSeriesOnly: "/send-series-now?confirm=SEND",
        sendAllDue: "/send-due-now?confirm=SEND",
        sendMilestone100: "/send-milestone-100?confirm=SEND"
      });
    } catch (error) {
      return json({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendScheduledForLocalTime(env));
  }
};

async function checkToday(env) {
  const now = new Date();
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", now);
  const candidates = await loadTodayCandidates(env, local.date);

  return json({
    ok: true,
    worker: "Daily Dose Auto Email Worker is live",
    source: "live website",
    date: local.date,
    localTime: local.time,
    latestDailyDose: summarizeCandidate(candidates.find((candidate) => candidate.collection === "daily"), now, env),
    latestSeriesDose: summarizeCandidate(candidates.find((candidate) => candidate.collection === "series"), now, env),
    milestone100: {
      date: "2026-08-02",
      localTime: "10:00",
      subject: getMilestone100Content(env).subject
    },
    note: "Scheduled sends happen at local 7am for daily devotions, local 7pm for series devotions, and 10am on 2026-08-02 for the Daily Dose #100 thank-you email."
  });
}

async function previewEmail(env) {
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", new Date());
  const candidate = await loadDevotionCandidate(env, "daily", local.date) || await loadDevotionCandidate(env, "series", local.date);

  if (!candidate) {
    return new Response("No devotion found for today's preview.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return new Response(renderDevotionHtml(env, candidate), { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function previewMilestone100(env) {
  return new Response(renderMilestone100Html(env), { headers: { "content-type": "text/html; charset=utf-8" } });
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

  if (!isEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

  const response = await brevoFetch(env, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      attributes: name ? { FIRSTNAME: name } : undefined,
      listIds: [Number(env.BREVO_LIST_ID)],
      updateEnabled: true
    })
  });

  if (!response.ok) return brevoError(response);
  return json({ ok: true });
}

async function sendManualCollection(env, collection, note) {
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", new Date());
  const candidate = await loadDevotionCandidate(env, collection, local.date);

  if (!candidate) return { ok: false, date: local.date, message: `No ${collection} devotion found for today.` };
  if (!isDue(candidate, new Date())) {
    return { ok: false, date: local.date, message: `${collection} devotion is not due yet.`, publishAt: getPublishAt(candidate).toISOString() };
  }

  await sendDevotionCampaign(env, candidate);
  await markSent(env, candidate);

  return { ok: true, sent: [{ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title, source: candidate.source }], note };
}

async function sendScheduledForLocalTime(env) {
  const now = new Date();
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", now);

  if (local.hour === 7) return sendDueDevotions(env, { collections: ["daily"] });
  if (local.date === "2026-08-02" && local.hour === 10) return sendMilestone100Email(env);
  if (local.hour === 19) return sendDueDevotions(env, { collections: ["series"] });

  return { ok: true, skipped: true, localTime: local.time, reason: "Not the local 7am or 7pm send window." };
}

async function sendDueDevotions(env, options = {}) {
  const now = new Date();
  const local = getLocalParts(env.APP_TIME_ZONE || "Europe/Dublin", now);
  const candidates = await loadTodayCandidates(env, local.date);
  const sent = [];
  const skipped = [];

  for (const candidate of candidates) {
    if (options.collections && !options.collections.includes(candidate.collection)) {
      skipped.push({ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title, reason: "Not in this send window" });
      continue;
    }

    if (!isDue(candidate, now)) {
      skipped.push({ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title, reason: "Not live yet", publishAt: getPublishAt(candidate).toISOString() });
      continue;
    }

    if (!options.manual && await wasSent(env, candidate)) {
      skipped.push({ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title, reason: "Already sent" });
      continue;
    }

    await sendDevotionCampaign(env, candidate);
    await markSent(env, candidate);
    sent.push({ collection: candidate.collection, date: candidate.date, title: candidate.devotion.title, source: candidate.source });
  }

  return { ok: true, date: local.date, sent, skipped };
}

async function sendMilestone100Email(env, options = {}) {
  const candidate = getMilestone100Candidate(env);

  if (!options.force && await wasSent(env, candidate)) {
    return { ok: true, skipped: true, reason: "Already sent", date: candidate.date, title: candidate.devotion.title };
  }

  await sendMilestone100Campaign(env);
  await markSent(env, candidate);

  return {
    ok: true,
    sent: [{
      collection: candidate.collection,
      date: candidate.date,
      title: candidate.devotion.title,
      source: options.manual ? "manual milestone send" : "scheduled milestone send"
    }],
    note: "Daily Dose #100 thank-you email sent to the Brevo subscriber list."
  };
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
  return loadWebsiteDevotionCandidate(env, collection, date);
}

async function loadWebsiteDevotionCandidate(env, collection, date) {
  const archivePath = collection === "series" ? "series.html" : "devotions.html";
  const archiveHtml = await getTextFromLiveSite(env, archivePath);
  const card = findArchiveCard(archiveHtml, collection, date);

  if (!card) return null;

  const pagePath = normalizeSitePath(card.href);
  const pageHtml = await getTextFromLiveSite(env, pagePath);
  const devotion = parseDevotionPage(pageHtml, collection, pagePath, env);

  if (!devotion.publishAt && card.publishAt) devotion.publishAt = card.publishAt;
  if (!devotion.url) devotion.url = `${getSiteUrl(env)}/${pagePath}`;
  normalizeDevotion(devotion);

  return { collection, date, path: pagePath, devotion, source: "live website" };
}

function findArchiveCard(html, collection, date) {
  const articlePattern = /<article\b[\s\S]*?<\/article>/gi;
  const articles = html.match(articlePattern) || [];

  for (const article of articles) {
    const publishAt = attr(article, "data-publish-at");
    if (!publishAt || !publishAt.startsWith(date)) continue;

    const hrefMatch = article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1];
    if (collection === "daily" && !href.includes("devotions/")) continue;
    if (collection === "series" && !href.includes("series/")) continue;

    return { publishAt, href };
  }

  return null;
}

function parseDevotionPage(html, collection, path, env) {
  const eyebrow = textBetween(html, /<p\b[^>]*class=["'][^"']*eyebrow[^"']*["'][^>]*>/i, /<\/p>/i);
  const h1 = textBetween(html, /<h1\b[^>]*>/i, /<\/h1>/i);
  const scripture = textBetween(html, /<h3\b[^>]*class=["'][^"']*scripture-heading[^"']*["'][^>]*>/i, /<\/h3>/i) || textBetween(html, /<div\b[^>]*class=["'][^"']*scripture-box[^"']*["'][^>]*>[\s\S]*?<h3\b[^>]*>/i, /<\/h3>/i);
  const bodyHtml = textBetween(html, /<div\b[^>]*class=["'][^"']*devotion-body[^"']*["'][^>]*>/i, /<\/div>/i, true);
  const publishAt = attr(html, "data-publish-at");
  const pageUrl = `${getSiteUrl(env)}/${path}`;
  const title = [eyebrow, h1].filter(Boolean).join(": ") || stripTags(textBetween(html, /<title\b[^>]*>/i, /<\/title>/i));
  const body = extractReadableBody(bodyHtml);

  if (!title || !body) throw new Error(`Could not parse devotion page ${path}.`);

  return { title, scripture: scripture || undefined, body, publishAt: publishAt || undefined, url: pageUrl };
}

function extractReadableBody(bodyHtml) {
  const chunks = [];
  const blockPattern = /<(p|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = blockPattern.exec(bodyHtml))) {
    const text = stripTags(match[2]);
    if (text) chunks.push(text);
  }

  return chunks.join("\n\n");
}

async function getTextFromLiveSite(env, path) {
  const pageUrl = new URL(normalizeSitePath(path), `${getSiteUrl(env)}/`);
  pageUrl.searchParams.set("emailWorker", String(Date.now()));

  const response = await fetch(pageUrl.href, {
    headers: { "User-Agent": "daily-dose-devotions-worker" },
    cf: { cacheTtl: 0, cacheEverything: false }
  });

  if (!response.ok) throw new Error(`Could not load ${path} from live website: ${response.status} ${await response.text()}`);
  return response.text();
}

async function sendDevotionCampaign(env, candidate) {
  const { devotion, date, collection } = candidate;
  const html = renderDevotionHtml(env, candidate);
  const text = renderDevotionText(env, candidate);
  const senderEmail = env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL;

  if (!senderEmail) throw new Error("Set BREVO_SENDER_EMAIL or NOTIFY_EMAIL in Cloudflare variables.");

  const createResponse = await brevoFetch(env, "/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: `Daily Dose ${collection} ${date}`,
      subject: devotion.emailSubject || devotion.title,
      sender: { name: env.BREVO_SENDER_NAME || "Daily Dose Devotions", email: senderEmail },
      type: "classic",
      htmlContent: html,
      textContent: text,
      recipients: { listIds: [Number(env.BREVO_LIST_ID)] }
    })
  });

  if (!createResponse.ok) throw new Error(`Brevo campaign create failed: ${createResponse.status} ${await createResponse.text()}`);

  const created = await createResponse.json();
  const sendResponse = await brevoFetch(env, `/emailCampaigns/${created.id}/sendNow`, { method: "POST" });

  if (!sendResponse.ok) throw new Error(`Brevo campaign send failed: ${sendResponse.status} ${await sendResponse.text()}`);
}

async function sendMilestone100Campaign(env) {
  const content = getMilestone100Content(env);
  const senderEmail = env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL;

  if (!senderEmail) throw new Error("Set BREVO_SENDER_EMAIL or NOTIFY_EMAIL in Cloudflare variables.");

  const createResponse = await brevoFetch(env, "/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: "Daily Dose #100 thank-you email",
      subject: content.subject,
      sender: { name: env.BREVO_SENDER_NAME || "Daily Dose Devotions", email: senderEmail },
      type: "classic",
      htmlContent: renderMilestone100Html(env),
      textContent: renderMilestone100Text(env),
      recipients: { listIds: [Number(env.BREVO_LIST_ID)] }
    })
  });

  if (!createResponse.ok) throw new Error(`Brevo milestone campaign create failed: ${createResponse.status} ${await createResponse.text()}`);

  const created = await createResponse.json();
  const sendResponse = await brevoFetch(env, `/emailCampaigns/${created.id}/sendNow`, { method: "POST" });

  if (!sendResponse.ok) throw new Error(`Brevo milestone campaign send failed: ${sendResponse.status} ${await sendResponse.text()}`);
}

function getMilestone100Content(env) {
  return {
    subject: "100 Days of Daily Dose - Thank You",
    title: "100 Days of Daily Dose",
    subtitle: "Thank You for Walking With Us",
    date: "2026-08-02",
    devotionUrl: `${getSiteUrl(env)}/devotions/daily-dose-100.html`,
    subscribeUrl: `${getSiteUrl(env)}/subscribe`,
    lines: [
      "Today Daily Dose reaches #100.",
      "One hundred days of Scripture, reflection, and real life. One hundred days of opening the Word, turning our eyes back to Christ, and remembering that grace is still enough for today.",
      "Thank you for being part of it. Thank you for reading, praying, sharing, subscribing, and encouraging this small ministry as it grows one day at a time.",
      "Daily Dose was never meant to be about numbers alone. It is about hearts being pointed back to Jesus. If even one person pauses, opens Scripture, and takes another step toward Christ, then it matters.",
      "Here is to the next 100 days, and to every year the Lord allows. May Daily Dose keep being a quiet place of truth, encouragement, repentance, recovery, and hope.",
      "Thank you for walking with us. Keep going in the Word. Keep turning back to Christ. One day at a time."
    ]
  };
}

function getMilestone100Candidate(env) {
  const content = getMilestone100Content(env);
  return {
    collection: "milestone",
    date: content.date,
    path: "daily-dose-100-thank-you-email",
    devotion: {
      title: content.subject,
      body: content.lines.join("\n\n"),
      url: content.devotionUrl
    },
    source: "scheduled milestone"
  };
}

function renderDevotionHtml(env, candidate) {
  const { devotion, date, collection } = candidate;
  const devotionUrl = getDevotionUrl(env, candidate);
  const label = collection === "series" ? "Daily Dose Series" : "Daily Dose Devotions";
  const intro = collection === "series" ? "A Sunday formation reflection from Daily Dose." : "Your daily devotion, sent with prayer and purpose.";
  const paragraphs = devotion.body.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 20px;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(devotion.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ede7dc;color:#222824;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ede7dc;margin:0;padding:30px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf1;border:1px solid #d8cbb8;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(38,63,54,.10);">
            <tr>
              <td style="background:#233d34;padding:28px 28px 24px;text-align:center;border-bottom:5px solid #c8a968;">
                <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d9c28f;font-weight:700;">${escapeHtml(label)}</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1;color:#fffaf1;font-weight:700;margin-top:10px;">Daily Dose</div>
                <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#efe4d1;margin-top:10px;">${escapeHtml(formatEmailDate(date))}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 30px 8px;text-align:center;">
                <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#6f6253;text-transform:uppercase;letter-spacing:1.8px;font-weight:700;">${escapeHtml(intro)}</div>
                <h1 style="margin:16px 0 0;color:#202620;font-size:32px;line-height:1.18;font-weight:700;">${escapeHtml(devotion.title)}</h1>
              </td>
            </tr>
            ${devotion.scripture ? `<tr>
              <td style="padding:20px 30px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0eadf;border-left:4px solid #c8a968;border-radius:4px;">
                  <tr>
                    <td style="padding:18px 20px;text-align:center;">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f6253;font-weight:700;margin-bottom:6px;">Today's Scripture</div>
                      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2d5a4e;font-weight:700;">${escapeHtml(devotion.scripture)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>` : ""}
            <tr>
              <td style="padding:24px 32px 10px;">
                <div style="height:1px;background:#ded2c0;margin:0 auto 28px;width:100%;"></div>
                <div style="font-size:18px;line-height:1.78;color:#2c302d;">${paragraphs}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 38px;text-align:center;">
                <a href="${escapeHtml(devotionUrl)}" style="display:inline-block;background:#2f5c50;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 22px;border-radius:4px;">${escapeHtml(getFooterLinkText(candidate))}</a>
                <div style="height:1px;background:#ded2c0;margin:30px auto 18px;width:72%;"></div>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#776b5f;">Daily Dose Devotions<br>Helping hearts return to the Word, one day at a time.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderDevotionText(env, candidate) {
  const { devotion, date } = candidate;
  const devotionUrl = getDevotionUrl(env, candidate);

  return [`Daily Dose Devotions - ${formatEmailDate(date)}`, devotion.title, devotion.scripture, devotion.body, `${getFooterLinkText(candidate)}: ${devotionUrl}`].filter(Boolean).join("\n\n");
}

function renderMilestone100Html(env) {
  const content = getMilestone100Content(env);
  const paragraphs = content.lines.map((line) => `<p style="margin:0 0 20px;">${escapeHtml(line)}</p>`).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ede7dc;color:#222824;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ede7dc;margin:0;padding:30px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf1;border:1px solid #d8cbb8;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(38,63,54,.10);">
            <tr>
              <td style="background:#233d34;padding:30px 28px 26px;text-align:center;border-bottom:5px solid #c8a968;">
                <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d9c28f;font-weight:700;">Daily Dose Devotions</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1;color:#fffaf1;font-weight:700;margin-top:14px;">100 Days</div>
                <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#efe4d1;margin-top:12px;">${escapeHtml(formatEmailDate(content.date))}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 8px;text-align:center;">
                <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#6f6253;text-transform:uppercase;letter-spacing:1.8px;font-weight:700;">${escapeHtml(content.subtitle)}</div>
                <h1 style="margin:16px 0 0;color:#202620;font-size:34px;line-height:1.18;font-weight:700;">${escapeHtml(content.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 10px;">
                <div style="height:1px;background:#ded2c0;margin:0 auto 28px;width:100%;"></div>
                <div style="font-size:18px;line-height:1.78;color:#2c302d;">${paragraphs}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 38px;text-align:center;">
                <a href="${escapeHtml(content.devotionUrl)}" style="display:inline-block;background:#2f5c50;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 22px;border-radius:4px;">Read Daily Dose #100</a>
                <div style="height:1px;background:#ded2c0;margin:30px auto 18px;width:72%;"></div>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#776b5f;">Daily Dose Devotions<br>Helping hearts return to the Word, one day at a time.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderMilestone100Text(env) {
  const content = getMilestone100Content(env);
  return [
    content.subject,
    content.subtitle,
    ...content.lines,
    `Read Daily Dose #100: ${content.devotionUrl}`,
    "Daily Dose Devotions - Helping hearts return to the Word, one day at a time."
  ].join("\n\n");
}

function getDevotionUrl(env, candidate) {
  if (candidate.devotion.url) return candidate.devotion.url;
  const siteUrl = getSiteUrl(env);
  return candidate.collection === "series" ? `${siteUrl}/series.html` : `${siteUrl}/devotions.html`;
}

function getFooterLinkText(candidate) {
  return candidate.collection === "series" ? "Open the Series page" : "Open Daily Devotions";
}

function summarizeCandidate(candidate, now, env) {
  if (!candidate) return null;
  const publishAt = getPublishAt(candidate);
  return { title: candidate.devotion.title, scripture: candidate.devotion.scripture || null, url: getDevotionUrl(env, candidate), publishAt: publishAt.toISOString(), due: now >= publishAt, source: candidate.source };
}

function getPublishAt(candidate) {
  const configured = candidate.devotion.publishAt || candidate.devotion.releaseAt || candidate.devotion.liveAt;
  if (configured) return new Date(configured);
  return localDateTimeToUtc(candidate.date, candidate.collection === "series" ? "19:00" : "07:00", "Europe/Dublin");
}

function isDue(candidate, now) {
  const publishAt = getPublishAt(candidate);
  return Number.isFinite(publishAt.getTime()) && now >= publishAt;
}

async function wasSent(env, candidate) {
  const store = getSentStore(env);
  if (!store) return false;
  return Boolean(await store.get(sentKey(candidate)));
}

async function markSent(env, candidate) {
  const store = getSentStore(env);
  if (store) await store.put(sentKey(candidate), new Date().toISOString());
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
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json", ...init.headers }
  });
}

async function brevoError(response) {
  const body = await response.text();
  return json({ error: "Brevo request failed.", status: response.status, details: body }, 502);
}

function getSiteUrl(env) {
  return (env.SITE_URL || "https://dailydosedevotions.ie").replace(/\/$/, "");
}

function normalizeSitePath(href) {
  return href.replace(/^https?:\/\/[^/]+\//, "").replace(/^\//, "").replace(/^\.\//, "").replace(/^\.\.\//, "");
}

function normalizeDevotion(devotion) {
  devotion.title = normalizeEmailText(devotion.title);
  devotion.emailSubject = devotion.emailSubject ? normalizeEmailText(devotion.emailSubject) : undefined;
  devotion.scripture = devotion.scripture ? normalizeEmailText(devotion.scripture) : undefined;
  devotion.body = normalizeEmailText(devotion.body);
}

function attr(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}=["']([^"']+)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function textBetween(html, startPattern, endPattern, keepHtml = false) {
  const start = html.search(startPattern);
  if (start < 0) return "";
  const afterStart = html.slice(start).match(startPattern)[0].length + start;
  const rest = html.slice(afterStart);
  const end = rest.search(endPattern);
  if (end < 0) return "";
  const value = rest.slice(0, end);
  return keepHtml ? value : stripTags(value);
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value) {
  return normalizeEmailText(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&middot;", "-")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&ldquo;", '"')
    .replaceAll("&rdquo;", '"')
    .replaceAll("&lsquo;", "'")
    .replaceAll("&rsquo;", "'")
    .replaceAll("&ndash;", "-")
    .replaceAll("&mdash;", "-")
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => normalizeEmailText(String.fromCharCode(parseInt(code, 16))))
    .replace(/&#(\d+);/g, (_, code) => normalizeEmailText(String.fromCharCode(Number(code))));
}

function normalizeEmailText(value) {
  return String(value || "")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u00e2\u0080\u0098", "'")
    .replaceAll("\u00e2\u0080\u0099", "'")
    .replaceAll("\u00e2\u0080\u009c", '"')
    .replaceAll("\u00e2\u0080\u009d", '"')
    .replaceAll("\u00e2\u0080\u0093", "-")
    .replaceAll("\u00e2\u0080\u0094", "-");
}

function formatEmailDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function getLocalParts(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, hour: Number(values.hour) };
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
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function json(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data, null, 2), {
    status,
    headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json; charset=utf-8" }
  });
}
