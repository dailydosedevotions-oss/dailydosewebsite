let dailyDoseInstallPrompt = null;
const installButton = document.querySelector('[data-install-app]');
const pwaOpenedAsApp = isStandalone();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  dailyDoseInstallPrompt = event;
  if (installButton) installButton.hidden = false;
  trackPwaEvent('prompt_shown');
});

installButton?.addEventListener('click', async () => {
  trackPwaEvent('install_button_tap');

  if (!dailyDoseInstallPrompt) {
    trackPwaEvent(isAppleMobile() ? 'ios_add_to_home_tap' : 'browser_install_help_tap');
    installButton.textContent = isAppleMobile() ? 'Use Share > Add to Home Screen' : 'Use Browser Menu to Install';
    return;
  }

  dailyDoseInstallPrompt.prompt();
  const choice = await dailyDoseInstallPrompt.userChoice.catch(() => null);
  if (choice?.outcome === 'accepted') {
    trackPwaEvent('install_prompt_accepted');
  } else if (choice?.outcome === 'dismissed') {
    trackPwaEvent('install_prompt_dismissed');
  }
  dailyDoseInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  dailyDoseInstallPrompt = null;
  if (installButton) installButton.hidden = true;
  trackPwaEvent('app_installed');
});

if (installButton && isAppleMobile() && !isStandalone()) {
  installButton.hidden = false;
  installButton.textContent = 'Add to Home Screen';
}

if (pwaOpenedAsApp) {
  trackPwaEventOnceEver('first_standalone_open');
  trackPwaEventOncePerDay('standalone_open');
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function getDisplayMode() {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return 'standalone';
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
  return 'browser';
}

function getPlatform() {
  if (isAppleMobile()) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (/windows/i.test(navigator.userAgent)) return 'windows';
  if (/macintosh|mac os x/i.test(navigator.userAgent)) return 'mac';
  return 'other';
}

function trackPwaEventOncePerDay(event) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily-dose-pwa:${event}:${today}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch (error) {
    // Keep tracking non-essential so browser privacy settings never break the app.
  }
  trackPwaEvent(event);
}

function trackPwaEventOnceEver(event) {
  const key = `daily-dose-pwa:${event}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch (error) {
    // Keep tracking non-essential so browser privacy settings never break the app.
  }
  trackPwaEvent(event);
}

function trackPwaEvent(event) {
  const payload = JSON.stringify({
    event,
    page: window.location.pathname || '/',
    platform: getPlatform(),
    displayMode: getDisplayMode()
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/pwa-stats', blob);
    return;
  }

  fetch('/api/pwa-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}
