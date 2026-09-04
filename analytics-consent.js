(function () {
  'use strict';

  const MEASUREMENT_ID = 'G-TSTZL7T2F9';
  const STORAGE_KEY = 'daily_dose_analytics_consent';
  const GA_HOST = 'https://www.googletagmanager.com';
  let configured = false;
  let loading = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // Consent Mode v2 defaults are recorded before Google code is requested.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);

  function storedChoice() {
    try {
      const choice = localStorage.getItem(STORAGE_KEY);
      return choice === 'granted' || choice === 'denied' ? choice : null;
    } catch (_) {
      return null;
    }
  }

  function storeChoice(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
  }

  function clearGaCookies() {
    const hostParts = location.hostname.split('.');
    const domains = ['', location.hostname, `.${location.hostname}`];
    if (hostParts.length > 2) domains.push(`.${hostParts.slice(-2).join('.')}`);

    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      domains.forEach(domain => {
        const domainPart = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; Max-Age=0; path=/${domainPart}; SameSite=Lax; Secure`;
      });
    });
  }

  function loadAnalytics() {
    if (configured || loading) return;
    loading = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `${GA_HOST}/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    script.dataset.dailyDoseAnalytics = 'true';
    script.onload = () => {
      window.gtag('js', new Date());
      window.gtag('config', MEASUREMENT_ID, {
        send_page_view: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
      configured = true;
      loading = false;
    };
    script.onerror = () => { loading = false; };
    document.head.appendChild(script);
  }

  function setConsent(choice) {
    const wasRunning = configured || loading || Boolean(document.querySelector('[data-daily-dose-analytics]'));
    storeChoice(choice);
    window.gtag('consent', 'update', {
      analytics_storage: choice,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });

    if (choice === 'granted') loadAnalytics();
    else {
      clearGaCookies();
      // Reload after withdrawal so Enhanced Measurement listeners and Google's
      // runtime are removed from the current document as well as future pages.
      if (wasRunning) {
        location.reload();
        return;
      }
    }

    document.documentElement.dataset.analyticsConsent = choice;
    document.getElementById('analyticsConsentBanner')?.setAttribute('hidden', '');
    document.getElementById('analyticsConsentDialog')?.close();
  }

  function buildControls() {
    const banner = document.createElement('section');
    banner.id = 'analyticsConsentBanner';
    banner.className = 'analytics-consent-banner';
    banner.setAttribute('aria-label', 'Analytics privacy choices');
    banner.innerHTML = `
      <div class="analytics-consent-copy">
        <strong>Privacy choices</strong>
        <p>With your permission, Daily Dose uses Google Analytics to understand readership and improve the site. Analytics is off unless you accept.</p>
        <a href="/privacy.html#analytics">Read our privacy policy</a>
      </div>
      <div class="analytics-consent-actions">
        <button type="button" class="analytics-consent-button secondary" data-consent="denied">Reject analytics</button>
        <button type="button" class="analytics-consent-button primary" data-consent="granted">Accept analytics</button>
      </div>`;

    const dialog = document.createElement('dialog');
    dialog.id = 'analyticsConsentDialog';
    dialog.className = 'analytics-consent-dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <button class="analytics-consent-close" value="cancel" aria-label="Close privacy choices">&times;</button>
        <p class="eyebrow">Privacy</p>
        <h2>Analytics choices</h2>
        <p>Google Analytics is optional and is currently <strong data-consent-status>off</strong>. Essential site features and the separate aggregate app-install counter work either way.</p>
        <div class="analytics-consent-actions">
          <button type="button" class="analytics-consent-button secondary" data-consent="denied">Reject analytics</button>
          <button type="button" class="analytics-consent-button primary" data-consent="granted">Accept analytics</button>
        </div>
        <a href="/privacy.html#analytics">More information in the privacy policy</a>
      </form>`;

    const reopen = document.createElement('button');
    reopen.id = 'analyticsPrivacyChoices';
    reopen.className = 'analytics-privacy-choices';
    reopen.type = 'button';
    reopen.textContent = 'Privacy choices';
    reopen.setAttribute('aria-haspopup', 'dialog');

    document.body.append(banner, dialog, reopen);

    document.querySelectorAll('[data-consent]').forEach(button => {
      button.addEventListener('click', () => setConsent(button.dataset.consent));
    });
    reopen.addEventListener('click', () => {
      const status = dialog.querySelector('[data-consent-status]');
      status.textContent = storedChoice() === 'granted' ? 'on' : 'off';
      dialog.showModal();
    });

    const choice = storedChoice();
    if (choice) {
      banner.hidden = true;
      document.documentElement.dataset.analyticsConsent = choice;
      if (choice === 'granted') {
        window.gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied'
        });
        loadAnalytics();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildControls, { once: true });
  } else {
    buildControls();
  }
})();
