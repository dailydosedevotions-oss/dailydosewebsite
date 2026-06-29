export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-prayer-admin-token"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (request.method === "GET") {
      const store = getStore(env);
      if (!store) return json({ success: true, prayers: [], answered: [] }, 200, corsHeaders);

      const url = new URL(request.url);
      const emailAction = clean(url.searchParams.get("moderate"));
      const emailId = clean(url.searchParams.get("id"));

      if (emailAction || emailId) {
        if (!canModerate(request, env)) {
          return htmlMessage("Prayer Review", "This prayer review link is private or has expired.", 403);
        }

        const result = await moderatePrayer(store, emailId, emailAction, env, request.url);
        if (!result.success) {
          return htmlMessage("Prayer Review", result.error, result.status || 400);
        }

        return htmlMessage(
          "Prayer Review",
          result.action === "approve" && result.private
            ? "This private prayer has been accepted. If they gave an email address, they have been told Daily Dose received it and will be praying."
            : result.action === "approve"
              ? "This prayer has been approved and is now on the prayer wall. If they gave an email address, they have been told it was accepted."
              : "This prayer has been declined and will not appear on the prayer wall.",
          200
        );
      }

      if (url.searchParams.get("pending") === "true") {
        if (!canModerate(request, env)) {
          return json({ success: false, error: "Prayer moderation is private." }, 403, corsHeaders);
        }

        return json({
          success: true,
          pending: await getPendingItems(store)
        }, 200, corsHeaders);
      }

      const items = await getPublicItems(store);
      return json({
        success: true,
        prayers: items.filter(item => item.type === "prayer"),
        answered: items.filter(item => item.type === "answered")
      }, 200, corsHeaders);
    }

    if (request.method === "POST") {
      const body = await readSubmission(request);
      const name = clean(body.name).slice(0, 80) || "Anonymous";
      const email = clean(body.email).slice(0, 160);
      const message = clean(body.message).slice(0, 1200);
      const type = body.type === "answered" ? "answered" : "prayer";
      const isPrivate = body.private === true || body.private === "true" || body.private === "Yes" || body.private === "on";

      if (!message) {
        return json({ success: false, error: "Please enter a prayer request or answered prayer." }, 400, corsHeaders);
      }

      const item = {
        id: `${Date.now()}-${crypto.randomUUID()}`,
        type,
        name,
        message,
        private: isPrivate,
        createdAt: new Date().toISOString()
      };

      const store = getStore(env);
      if (!store) {
        return json({ success: false, error: "Prayer wall storage is not configured yet." }, 500, corsHeaders);
      }

      const pending = await getPendingItems(store);
      pending.unshift({ ...publicItem(item), private: isPrivate, email });
      await store.put("prayer-wall:pending", JSON.stringify(pending.slice(0, 80)));

      await sendPrayerNotification(env, { ...item, email }, request.url);

      return json({
        success: true,
        private: isPrivate,
        pending: !isPrivate,
        item: null
      }, 200, corsHeaders);
    }

    if (request.method === "PUT") {
      const store = getStore(env);
      if (!store) return json({ success: false, error: "Prayer wall storage is not configured yet." }, 500, corsHeaders);
      if (!canModerate(request, env)) return json({ success: false, error: "Prayer moderation is private." }, 403, corsHeaders);

      const body = await request.json().catch(() => ({}));
      const id = clean(body.id);
      const action = clean(body.action);

      if (!id || !["approve", "reject"].includes(action)) {
        return json({ success: false, error: "Choose approve or reject for a pending prayer." }, 400, corsHeaders);
      }

      const result = await moderatePrayer(store, id, action, env, request.url);
      return json(result, result.success ? 200 : result.status || 400, corsHeaders);
    }

    return json({ success: false, error: "Method not allowed" }, 405, corsHeaders);
  } catch (error) {
    return json({ success: false, error: error.message || "Server error" }, 500, corsHeaders);
  }
}

function getStore(env) {
  return env.PRAYER_WALL || env.VOTD_STATS;
}

async function readSubmission(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

async function getPublicItems(store) {
  const existing = await store.get("prayer-wall:public", { type: "json" });
  return Array.isArray(existing) ? existing : [];
}

async function getPendingItems(store) {
  const existing = await store.get("prayer-wall:pending", { type: "json" });
  return Array.isArray(existing) ? existing : [];
}

async function moderatePrayer(store, id, action, env, requestUrl) {
  const normalizedAction = action === "decline" ? "reject" : action;

  if (!id || !["approve", "reject"].includes(normalizedAction)) {
    return { success: false, error: "Choose approve or decline for a pending prayer.", status: 400 };
  }

  const pending = await getPendingItems(store);
  const item = pending.find(entry => entry.id === id);
  const remaining = pending.filter(entry => entry.id !== id);

  if (!item) {
    return { success: false, error: "Pending prayer was not found. It may already have been reviewed.", status: 404 };
  }

  let emailed = false;

  if (normalizedAction === "approve") {
    if (!item.private) {
      const publicItems = await getPublicItems(store);
      publicItems.unshift(publicItem(item));
      await store.put("prayer-wall:public", JSON.stringify(publicItems.slice(0, 60)));
    }

    emailed = await sendSubmitterPrayerAcceptedEmail(env, item, requestUrl);
  }

  await store.put("prayer-wall:pending", JSON.stringify(remaining));
  return {
    success: true,
    action: normalizedAction,
    item: publicItem(item),
    private: Boolean(item.private),
    emailed,
    pending: remaining
  };
}

async function sendSubmitterPrayerAcceptedEmail(env, item, requestUrl) {
  if (!env.BREVO_API_KEY || !item.email || !isEmail(item.email)) return false;

  const senderEmail = env.SENDER_EMAIL || "dailydosedevotions@gmail.com";
  const senderName = env.SENDER_NAME || "Daily Dose Devotions";
  const siteUrl = clean(env.SITE_URL || env.PUBLIC_SITE_URL) || new URL(requestUrl).origin;
  const isPrivate = Boolean(item.private);
  const kind = item.type === "answered" ? "answered prayer" : "prayer request";
  const subject = isPrivate
    ? "We received your prayer request - Daily Dose"
    : "Your prayer request has been accepted - Daily Dose";
  const message = isPrivate
    ? "Thank you for trusting Daily Dose with your prayer request. We have received it, it will remain private, and we will be praying with you."
    : "Thank you for sharing your prayer request with Daily Dose. It has been accepted for the prayer wall, and we will be praying with you.";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: item.email,
          name: item.name || undefined
        }
      ],
      subject,
      textContent: [
        `Hi ${item.name && item.name !== "Anonymous" ? item.name : "there"},`,
        "",
        message,
        "",
        "You are not alone in this. Thank you for allowing us to stand with you in prayer.",
        "",
        "Daily Dose Devotions",
        siteUrl
      ].join("\n"),
      htmlContent: buildSubmitterPrayerAcceptedHtml({ item, subject, message, siteUrl, kind })
    })
  });

  return response.ok;
}

function buildSubmitterPrayerAcceptedHtml({ item, subject, message, siteUrl, kind }) {
  const greeting = item.name && item.name !== "Anonymous" ? `Hi ${item.name},` : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;background:#ede7dc;color:#222824;font-family:Georgia,'Times New Roman',serif;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#fffaf1;border:1px solid #d8cbb8;border-radius:8px;overflow:hidden;">
    <div style="background:#233d34;padding:26px 28px;text-align:center;border-bottom:5px solid #c8a968;">
      <p style="margin:0;color:#d9c28f;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Daily Dose Prayer</p>
      <h1 style="margin:12px 0 0;color:#fffaf1;font-size:30px;line-height:1.2;">${escapeHtml(subject.replace(" - Daily Dose", ""))}</h1>
    </div>
    <div style="padding:30px 32px;font-size:18px;line-height:1.75;color:#2c302d;">
      <p style="margin:0 0 18px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px;">${escapeHtml(message)}</p>
      <p style="margin:0 0 22px;">You are not alone in this. Thank you for allowing us to stand with you in prayer.</p>
      <div style="background:#f0eadf;border-left:4px solid #c8a968;padding:16px 18px;margin:24px 0;">
        <p style="margin:0;color:#6f6253;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">${escapeHtml(kind)}</p>
        <p style="margin:8px 0 0;color:#2c302d;">${escapeHtml(item.message)}</p>
      </div>
      <p style="margin:26px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#776b5f;">Daily Dose Devotions<br><a href="${escapeHtml(siteUrl)}" style="color:#2f5c50;font-weight:700;">${escapeHtml(siteUrl)}</a></p>
    </div>
  </div>
</body>
</html>`;
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function publicItem(item) {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    message: item.message,
    createdAt: item.createdAt
  };
}

function clean(value) {
  return String(value || "").trim();
}

function canModerate(request, env) {
  const expectedToken = clean(env.PRAYER_ADMIN_TOKEN || env.PWA_STATS_TOKEN);
  if (!expectedToken) return false;

  const url = new URL(request.url);
  const queryToken = clean(url.searchParams.get("token"));
  const headerToken = clean(request.headers.get("x-prayer-admin-token"));

  return queryToken === expectedToken || headerToken === expectedToken;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...headers
    }
  });
}

function htmlMessage(title, message, status = 200) {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;background:#0a0a0a;color:#f4ede2;font-family:Arial,sans-serif;line-height:1.6;padding:40px}
    main{max-width:680px;margin:0 auto;background:#11100e;border:1px solid rgba(198,160,90,.35);padding:32px;border-radius:10px}
    h1{color:#c6a05a}
    a{color:#c6a05a}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/prayer-admin.html">Open Prayer Review</a></p>
  </main>
</body>
</html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

async function sendPrayerNotification(env, item, requestUrl) {
  if (!env.BREVO_API_KEY || !env.NOTIFY_EMAIL) return;

  const senderEmail = env.SENDER_EMAIL || "dailydosedevotions@gmail.com";
  const senderName = env.SENDER_NAME || "Daily Dose Devotions";
  const kind = item.type === "answered" ? "Answered prayer" : "Prayer request";
  const visibility = item.private ? "Private - not shown on the website" : "Pending review - not shown publicly until approved";
  const reviewLinks = buildReviewLinks(env, item, requestUrl);

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: env.NOTIFY_EMAIL
        }
      ],
      subject: `Daily Dose ${kind}`,
      textContent: [
        kind,
        visibility,
        "",
        `Name: ${item.name}`,
        item.email ? `Email: ${item.email}` : "Email: not provided",
        `Submitted: ${item.createdAt}`,
        ...reviewLinks.textLines,
        "",
        item.message
      ].join("\n"),
      htmlContent: buildPrayerEmailHtml({ item, kind, visibility, reviewLinks })
    })
  });
}

function buildReviewLinks(env, item, requestUrl) {
  const token = clean(env.PRAYER_ADMIN_TOKEN || env.PWA_STATS_TOKEN);
  if (!token) return { approveUrl: "", rejectUrl: "", textLines: [] };

  const baseUrl = clean(env.SITE_URL || env.PUBLIC_SITE_URL) || new URL(requestUrl).origin;
  const approveUrl = new URL("/api/prayers", baseUrl);
  approveUrl.searchParams.set("moderate", "approve");
  approveUrl.searchParams.set("id", item.id);
  approveUrl.searchParams.set("token", token);

  const rejectUrl = new URL("/api/prayers", baseUrl);
  rejectUrl.searchParams.set("moderate", "decline");
  rejectUrl.searchParams.set("id", item.id);
  rejectUrl.searchParams.set("token", token);

  return {
    approveUrl: approveUrl.toString(),
    rejectUrl: rejectUrl.toString(),
    textLines: [
      "",
      "Review:",
      `Approve: ${approveUrl.toString()}`,
      `Decline: ${rejectUrl.toString()}`
    ]
  };
}

function buildPrayerEmailHtml({ item, kind, visibility, reviewLinks }) {
  const hasReviewLinks = Boolean(reviewLinks.approveUrl && reviewLinks.rejectUrl);

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;background:#0a0a0a;color:#f4ede2;font-family:Arial,sans-serif;line-height:1.6;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#11100e;border:1px solid rgba(198,160,90,.35);border-radius:10px;padding:28px;">
    <p style="margin:0 0 8px;color:#c6a05a;text-transform:uppercase;font-size:12px;letter-spacing:2px;">Daily Dose</p>
    <h1 style="margin:0 0 12px;color:#ffffff;font-size:28px;">${escapeHtml(kind)}</h1>
    <p style="margin:0 0 20px;color:#d9cbb8;">${escapeHtml(visibility)}</p>
    <div style="border-top:1px solid rgba(198,160,90,.25);border-bottom:1px solid rgba(198,160,90,.25);padding:18px 0;margin:18px 0;">
      <p><strong>Name:</strong> ${escapeHtml(item.name)}</p>
      <p><strong>Email:</strong> ${item.email ? escapeHtml(item.email) : "not provided"}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(item.createdAt)}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap;color:#fffaf2;">${escapeHtml(item.message)}</p>
    </div>
    ${hasReviewLinks ? `
      <p style="margin:0 0 16px;color:#f4ede2;">Choose whether this should appear on the public prayer wall:</p>
      <p style="margin:0 0 8px;">
        <a href="${escapeHtml(reviewLinks.approveUrl)}" style="display:inline-block;background:#c6a05a;color:#0a0a0a;text-decoration:none;padding:12px 18px;border-radius:4px;font-weight:bold;margin:0 8px 10px 0;">Approve</a>
        <a href="${escapeHtml(reviewLinks.rejectUrl)}" style="display:inline-block;border:1px solid #c6a05a;color:#c6a05a;text-decoration:none;padding:11px 18px;border-radius:4px;font-weight:bold;margin:0 0 10px 0;">Decline</a>
      </p>
    ` : ""}
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
