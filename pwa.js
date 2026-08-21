document.querySelectorAll('.devotion-article > .share-panel').forEach(panel => {
  panel.remove();
});

let dailyDoseInstallPrompt = null;
const installButton = document.querySelector('[data-install-app]');
const pwaOpenedAsApp = isStandalone();
const usingSamsungInternet = /SamsungBrowser/i.test(navigator.userAgent);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();

  // Samsung Internet can route PWA installation through an obsolete WebAPK
  // package that modern Android blocks. Direct Samsung users to Chrome's
  // current PWA installer instead of invoking that unsafe package.
  if (usingSamsungInternet) {
    dailyDoseInstallPrompt = null;
    if (installButton) {
      installButton.hidden = false;
      installButton.textContent = 'Install Safely with Chrome';
    }
    trackPwaEvent('samsung_safe_install_shown');
    return;
  }

  dailyDoseInstallPrompt = event;
  if (installButton) installButton.hidden = false;
  trackPwaEvent('prompt_shown');
});

installButton?.addEventListener('click', async () => {
  trackPwaEvent('install_button_tap');

  if (usingSamsungInternet) {
    trackPwaEvent('samsung_open_chrome_tap');
    showSamsungInstallHelp();
    return;
  }

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

function showSamsungInstallHelp() {
  const existing = document.getElementById('safeInstallDialog');
  if (existing) {
    existing.showModal?.();
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'safeInstallDialog';
  dialog.setAttribute('aria-labelledby', 'safeInstallTitle');
  dialog.innerHTML = `
    <div style="max-width:460px;padding:8px;color:#f4ede2">
      <p class="eyebrow">Safe Android Install</p>
      <h2 id="safeInstallTitle" style="margin:0 0 14px">Install Daily Dose with Chrome</h2>
      <p style="margin:0 0 12px">Samsung Internet may create an older app package that Android blocks. There is no need to bypass Play Protect.</p>
      <p style="margin:0 0 22px">Open Daily Dose in Chrome, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong> from Chrome&rsquo;s menu.</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        <a class="btn primary" href="intent://dailydosedevotions.ie/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fdailydosedevotions.ie%2F;end">Open in Chrome</a>
        <button class="btn outline" type="button" data-close-install-help>Close</button>
      </div>
    </div>
  `;
  dialog.style.cssText = 'max-width:540px;width:calc(100% - 32px);border:1px solid rgba(198,160,90,.45);border-radius:12px;background:#11100e;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.65)';
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close-install-help]')) dialog.close();
  });
  document.body.appendChild(dialog);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    window.location.href = 'intent://dailydosedevotions.ie/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fdailydosedevotions.ie%2F;end';
  }
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
