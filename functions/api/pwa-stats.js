const ALLOWED_EVENTS = new Set([
  "prompt_shown",
  "install_button_tap",
  "install_prompt_accepted",
  "install_prompt_dismissed",
  "ios_add_to_home_tap",
  "browser_install_help_tap",
  "app_installed",
  "standalone_open"
]);

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
    const store = getStore(env);
    if (!store) {
      return json({ success: false, error: "PWA stats storage is not configured yet." }, 500, corsHeaders);
    }

    if (request.method === "GET") {
      if (!canViewStats(request, env)) {
        return json({ success: false, error: "PWA stats are private." }, 403, corsHeaders);
      }

      const totals = await getJson(store, "pwa-stats:totals", defaultStats());
      const todayKey = dayKey(new Date());
      const today = await getJson(store, todayKey, defaultStats());

      return json({
        success: true,
        totals,
        today,
        note: "PWA stats are aggregate counts only. iPhone Add to Home Screen installs cannot be confirmed by Safari, so use ios_add_to_home_tap and standalone_open as helpful signals."
      }, 200, corsHeaders);
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const event = String(body.event || "").trim();

      if (!ALLOWED_EVENTS.has(event)) {
        return json({ success: false, error: "Invalid PWA event." }, 400, corsHeaders);
      }

      const now = new Date();
      const page = clean(body.page).slice(0, 240);
      const platform = clean(body.platform).slice(0, 80);
      const displayMode = clean(body.displayMode).slice(0, 40);

      const totals = await updateStats(store, "pwa-stats:totals", event, now, { page, platform, displayMode });
      await updateStats(store, dayKey(now), event, now, { page, platform, displayMode });

      return json({ success: true, event, totals }, 200, corsHeaders);
    }

    return json({ success: false, error: "Method not allowed" }, 405, corsHeaders);
  } catch (error) {
    return json({ success: false, error: error.message || "Server error" }, 500, corsHeaders);
  }
}

function getStore(env) {
  return env.PWA_STATS || env.VOTD_STATS || env.PRAYER_WALL;
}

function canViewStats(request, env) {
  const expectedToken = clean(env.PWA_STATS_TOKEN);
  if (!expectedToken) return false;

  const url = new URL(request.url);
  const queryToken = clean(url.searchParams.get("token"));
  const headerToken = clean(request.headers.get("x-pwa-stats-token"));

  return queryToken === expectedToken || headerToken === expectedToken;
}

async function updateStats(store, key, event, now, details) {
  const stats = await getJson(store, key, defaultStats());
  stats[event] = (stats[event] || 0) + 1;
  stats.totalEvents = (stats.totalEvents || 0) + 1;
  stats.updatedAt = now.toISOString();
  stats.lastEvent = {
    event,
    page: details.page,
    platform: details.platform,
    displayMode: details.displayMode,
    at: now.toISOString()
  };
  await store.put(key, JSON.stringify(stats));
  return stats;
}

async function getJson(store, key, fallback) {
  const existing = await store.get(key, { type: "json" });
  return existing && typeof existing === "object" ? existing : fallback;
}

function defaultStats() {
  return {
    prompt_shown: 0,
    install_button_tap: 0,
    install_prompt_accepted: 0,
    install_prompt_dismissed: 0,
    ios_add_to_home_tap: 0,
    browser_install_help_tap: 0,
    app_installed: 0,
    standalone_open: 0,
    totalEvents: 0,
    updatedAt: null,
    lastEvent: null
  };
}

function dayKey(date) {
  return `pwa-stats:day:${date.toISOString().slice(0, 10)}`;
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
