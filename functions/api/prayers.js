export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (request.method === "GET") {
      const store = getStore(env);
      if (!store) return json({ success: true, prayers: [], answered: [] }, 200, corsHeaders);

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

        const items = await getPublicItems(store);
        items.unshift(publicItem(item));
        await store.put("prayer-wall:public", JSON.stringify(items.slice(0, 60)));
      }

      await sendPrayerNotification(env, { ...item, email });

      return json({
        success: true,
        private: isPrivate,
        item: isPrivate ? null : publicItem(item)
      }, 200, corsHeaders);
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
  const visibility = item.private ? "Private - not shown on the website" : "Public - shown on the prayer wall";

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
