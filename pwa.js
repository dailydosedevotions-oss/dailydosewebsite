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

if (installButton) {
  // Keep this visible on phones, including when Daily Dose is opened from
  // an existing home-screen shortcut.
  installButton.hidden = false;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();

  // Samsung Internet can route PWA installation through an obsolete WebAPK
  // package that modern Android blocks. Keep the branded home-screen control
  // visible, but direct Samsung users to Chrome's current PWA support.
  if (usingSamsungInternet) {
    dailyDoseInstallPrompt = null;
    trackPwaEvent('samsung_add_to_home_shown');
    return;
  }

  dailyDoseInstallPrompt = event;
  if (installButton && !pwaOpenedAsApp) installButton.hidden = false;
  trackPwaEvent('prompt_shown');
});

installButton?.addEventListener('click', async () => {
  trackPwaEvent('add_to_home_button_tap');

  if (pwaOpenedAsApp) {
    trackPwaEvent('already_on_home_screen_tap');
    showAddToHomeScreenHelp(true);
    return;
  }

  if (usingSamsungInternet) {
    trackPwaEvent('samsung_open_chrome_tap');
    showAddToHomeScreenHelp();
    return;
  }

  if (!dailyDoseInstallPrompt) {
    trackPwaEvent(isAppleMobile() ? 'ios_add_to_home_tap' : 'browser_add_to_home_help_tap');
    showAddToHomeScreenHelp();
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
  if (choice?.outcome === 'accepted') showAddToHomeScreenHelp(true);
});

window.addEventListener('appinstalled', () => {
  dailyDoseInstallPrompt = null;
  if (installButton) installButton.hidden = false;
  trackPwaEvent('app_installed');
});

if (pwaOpenedAsApp) {
  trackPwaEventOnceEver('first_standalone_open');
  trackPwaEventOncePerDay('standalone_open');
}

function showAddToHomeScreenHelp(alreadyAdded = false) {
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
      <p class="eyebrow">Daily Dose on Your Home Screen</p>
      <h2 id="safeInstallTitle" style="margin:0 0 14px">${alreadyAdded ? 'Daily Dose Is on Your Home Screen' : 'Add Daily Dose to Home Screen'}</h2>
      <p style="margin:0 0 22px">${alreadyAdded ? 'You already have quick access to Daily Dose from your home screen.' : getAddToHomeScreenInstructions()}</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        ${usingSamsungInternet && !alreadyAdded ? '<a class="btn primary" href="intent://dailydosedevotions.ie/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fdailydosedevotions.ie%2F;end">Open in Chrome</a>' : ''}
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

function getAddToHomeScreenInstructions() {
  if (isAppleMobile()) {
    return 'Tap the <strong>Share</strong> button in your browser, then choose <strong>Add to Home Screen</strong>.';
  }
  if (usingSamsungInternet) {
    return 'Open Daily Dose in Chrome, open Chrome&rsquo;s menu, then choose <strong>Add to Home screen</strong>.';
  }
  return 'Open your browser menu, then choose <strong>Add to Home screen</strong>.';
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
