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

  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      const date = url.searchParams.get("date");
      const reference = url.searchParams.get("reference") || "";

      if (!date) {
        return json({ success: false, error: "Missing date" }, 400, corsHeaders);
      }

      const key = verseKey(date, reference);
      const stats = await getStats(env, key);

      return json({
        success: true,
        date,
        reference,
        likes: stats.likes || 0,
        shares: stats.shares || 0
      }, 200, corsHeaders);
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const type = body.type;
      const date = body.date;
      const reference = body.reference || "";
      const text = body.text || "";
      const page = body.page || "https://dailydosedevotions.ie/#verse-of-the-day";
      const visitorId = body.visitorId || "anonymous";

      if (!["like", "share"].includes(type)) {
        return json({ success: false, error: "Invalid interaction type" }, 400, corsHeaders);
      }

      if (!date || !reference) {
        return json({ success: false, error: "Missing verse date or reference" }, 400, corsHeaders);
      }

      const key = verseKey(date, reference);
      const stats = await getStats(env, key);

      if (type === "like") {
        const likedKey = `votd-liked:${key}:${visitorId}`;
        const alreadyLiked = await env.VOTD_STATS.get(likedKey);

        if (!alreadyLiked) {
          stats.likes = (stats.likes || 0) + 1;
          await env.VOTD_STATS.put(likedKey, "1");
          await sendNotification(env, {
            subject: `Daily Dose Verse liked — ${reference}`,
            message: `Someone liked today's Verse of the Day.\n\nReference: ${reference}\nDate: ${date}\nCurrent likes: ${stats.likes}\n\nVerse:\n"${text}"\n\nPage:\n${page}`
          });
        }
      }

      if (type === "share") {
        stats.shares = (stats.shares || 0) + 1;
        await sendNotification(env, {
          subject: `Daily Dose Verse shared — ${reference}`,
          message: `Someone clicked Share Verse.\n\nReference: ${reference}\nDate: ${date}\nTotal share clicks recorded: ${stats.shares}\n\nVerse:\n"${text}"\n\nPage:\n${page}\n\nNote: Browsers do not always confirm whether a person completed the share after opening the share menu. This records the share button click/share intent.`
        });
      }

      stats.updatedAt = new Date().toISOString();
      await env.VOTD_STATS.put(key, JSON.stringify(stats));

      return json({
        success: true,
        date,
        reference,
        likes: stats.likes || 0,
        shares: stats.shares || 0
      }, 200, corsHeaders);
    }

    return json({ success: false, error: "Method not allowed" }, 405, corsHeaders);
  } catch (error) {
    return json({ success: false, error: error.message || "Server error" }, 500, corsHeaders);
  }
}

function verseKey(date, reference) {
  return `votd-stats:${date}:${reference.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

async function getStats(env, key) {
  const existing = await env.VOTD_STATS.get(key, { type: "json" });
  return existing || { likes: 0, shares: 0 };
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

async function sendNotification(env, { subject, message }) {
  if (!env.BREVO_API_KEY || !env.NOTIFY_EMAIL) {
    return;
  }

  const senderEmail = env.SENDER_EMAIL || "dailydosedevotions@gmail.com";
  const senderName = env.SENDER_NAME || "Daily Dose Devotions";

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
      subject,
      textContent: message
    })
  });
}
