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

      if (!isPrivate) {
        const store = getStore(env);
        if (!store) {
          return json({ success: false, error: "Prayer wall storage is not configured yet." }, 500, corsHeaders);
        }

        const pending = await getPendingItems(store);
        pending.unshift({ ...publicItem(item), email });
        await store.put("prayer-wall:pending", JSON.stringify(pending.slice(0, 80)));
      }

      await sendPrayerNotification(env, { ...item, email });

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

      const pending = await getPendingItems(store);
      const item = pending.find(entry => entry.id === id);
      const remaining = pending.filter(entry => entry.id !== id);

      if (!item) return json({ success: false, error: "Pending prayer was not found." }, 404, corsHeaders);

      if (action === "approve") {
        const publicItems = await getPublicItems(store);
        publicItems.unshift(publicItem(item));
        await store.put("prayer-wall:public", JSON.stringify(publicItems.slice(0, 60)));
      }

      await store.put("prayer-wall:pending", JSON.stringify(remaining));
      return json({ success: true, action, item: publicItem(item), pending: remaining }, 200, corsHeaders);
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

async function sendPrayerNotification(env, item) {
  if (!env.BREVO_API_KEY || !env.NOTIFY_EMAIL) return;

  const senderEmail = env.SENDER_EMAIL || "dailydosedevotions@gmail.com";
  const senderName = env.SENDER_NAME || "Daily Dose Devotions";
  const kind = item.type === "answered" ? "Answered prayer" : "Prayer request";
  const visibility = item.private ? "Private - not shown on the website" : "Pending review - not shown publicly until approved";

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
        "",
        item.message
      ].join("\n")
    })
  });
}
