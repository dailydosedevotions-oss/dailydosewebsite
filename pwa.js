let dailyDoseInstallPrompt = null;
const installButton = document.querySelector('[data-install-app]');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  dailyDoseInstallPrompt = event;
  if (installButton) installButton.hidden = false;
});

installButton?.addEventListener('click', async () => {
  if (!dailyDoseInstallPrompt) {
    installButton.textContent = isAppleMobile() ? 'Use Share > Add to Home Screen' : 'Use Browser Menu to Install';
    return;
  }

  dailyDoseInstallPrompt.prompt();
  await dailyDoseInstallPrompt.userChoice.catch(() => null);
  dailyDoseInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  dailyDoseInstallPrompt = null;
  if (installButton) installButton.hidden = true;
});

if (installButton && isAppleMobile() && !isStandalone()) {
  installButton.hidden = false;
  installButton.textContent = 'Add to Home Screen';
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
