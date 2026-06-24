export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-subscribe-admin-token"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json({ success: false, error: "Method not allowed." }, 405, corsHeaders);
  }

  if (!canView(request, env)) {
    return json({ success: false, error: "Subscribe health is private." }, 403, corsHeaders);
  }

  const apiKey = clean(env.BREVO_API_KEY);
  const listId = Number(env.BREVO_LIST_ID || 2);
  const notifyEmail = clean(env.NOTIFY_EMAIL || "dailydosedevotions@gmail.com");
  const senderEmail = clean(env.BREVO_SENDER_EMAIL || env.SENDER_EMAIL || env.NOTIFY_EMAIL || "dailydosedevotions@gmail.com");
  const senderName = clean(env.BREVO_SENDER_NAME || env.SENDER_NAME || "Daily Dose Devotions");

  if (!apiKey) {
    return json({
      success: false,
      configured: false,
      error: "BREVO_API_KEY is not configured in Cloudflare.",
      listId,
      notifyEmail,
      senderEmail,
      senderName
    }, 500, corsHeaders);
  }

  const checks = {
    apiKeyConfigured: true,
    listId,
    notifyEmail,
    senderEmail,
    senderName,
    list: null,
    account: null
  };

  const listResponse = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}`, {
    headers: {
      "accept": "application/json",
      "api-key": apiKey
    }
  });
  const listData = await listResponse.json().catch(() => ({}));

  if (!listResponse.ok) {
    return json({
      success: false,
      configured: true,
      error: listData.message || `Brevo could not find list ID ${listId}.`,
      checks
    }, 502, corsHeaders);
  }

  checks.list = {
    id: listData.id,
    name: listData.name,
    folderId: listData.folderId,
    totalSubscribers: listData.totalSubscribers,
    uniqueSubscribers: listData.uniqueSubscribers
  };

  const accountResponse = await fetch("https://api.brevo.com/v3/account", {
    headers: {
      "accept": "application/json",
      "api-key": apiKey
    }
  });
  const accountData = await accountResponse.json().catch(() => ({}));
  if (accountResponse.ok) {
    checks.account = {
      email: accountData.email,
      firstName: accountData.firstName,
      lastName: accountData.lastName,
      companyName: accountData.companyName
    };
  }

  return json({
    success: true,
    configured: true,
    message: "Brevo is reachable and the configured subscribe list exists.",
    checks
  }, 200, corsHeaders);
}

function canView(request, env) {
  const expectedToken = clean(env.SUBSCRIBE_ADMIN_TOKEN || env.PWA_STATS_TOKEN || env.PRAYER_ADMIN_TOKEN);
  if (!expectedToken) return false;

  const url = new URL(request.url);
  const queryToken = clean(url.searchParams.get("token"));
  const headerToken = clean(request.headers.get("x-subscribe-admin-token"));

  return queryToken === expectedToken || headerToken === expectedToken;
}

function clean(value) {
  return String(value || "").trim();
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
