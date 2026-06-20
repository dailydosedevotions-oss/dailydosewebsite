const navbar = document.getElementById('navbar');
const menu = document.getElementById('mobileMenu');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
});

menuBtn?.addEventListener('click', () => menu?.classList.add('open'));
closeBtn?.addEventListener('click', () => menu?.classList.remove('open'));

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      menu?.classList.remove('open');
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Daily Dose scheduled publishing: hides future devotions until their publish time.
(function () {
  const now = new Date();
  document.querySelectorAll('[data-publish-at]').forEach(el => {
    const publishAt = new Date(el.getAttribute('data-publish-at'));
    if (now < publishAt) {
      if (el.classList.contains('devotion-card')) {
        el.remove();
      } else if (document.body === el) {
        const warning = document.querySelector('.scheduled-warning');
        const body = document.querySelector('.devotion-body');
        if (warning) warning.hidden = false;
        if (body) body.innerHTML = '<p>This devotion is scheduled and will become available at 7am on its release date.</p>';
        document.querySelectorAll('.scheduled-sensitive').forEach(link => link.remove());
      }
    }
  });
  document.querySelectorAll('a.scheduled-sensitive[href]').forEach(link => {
    const url = new URL(link.getAttribute('href'), window.location.href);
    fetch(url.href)
      .then(response => response.text())
      .then(html => {
        const match = html.match(/<body[^>]*data-publish-at=["']([^"']+)["']/i);
        if (match && now < new Date(match[1])) link.remove();
      })
      .catch(() => {});
  });
  const archiveGrid = document.getElementById('archiveGrid');
  const emptyMsg = document.getElementById('noDevotionsMessage');
  if (archiveGrid && emptyMsg && archiveGrid.children.length === 0) emptyMsg.hidden = false;
})();


// Subscribe form: sends new subscribers to Brevo through Cloudflare Pages Functions.
(function () {
  const form = document.getElementById('subscribeForm');
  const status = document.getElementById('subscribeStatus');
  if (!form) return;

  form.setAttribute('action', '#');
  form.setAttribute('novalidate', 'novalidate');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();

    if (!email || !email.includes('@')) {
      if (status) status.textContent = 'Please enter a valid email address.';
      return false;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Subscribing...';
    }
    if (status) status.textContent = 'Subscribing...';

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Something went wrong. Please try again.');
      }

      form.reset();
      if (status) status.textContent = 'Thank you for subscribing. Please check your inbox for the Welcome Pack.';
      if (button) button.textContent = 'Subscribed';
    } catch (error) {
      if (status) status.textContent = error.message || 'Something went wrong. Please try again.';
      if (button) button.textContent = 'Subscribe to Daily Dose';
    } finally {
      if (button) {
        setTimeout(() => {
          button.disabled = false;
          if (button.textContent === 'Subscribed') button.textContent = 'Subscribe to Daily Dose';
        }, 2500);
      }
    }

    return false;
  });
})();

// Prayer wall: public submissions appear on the page; private ones email Daily Dose only.
(function () {
  const form = document.getElementById('prayerForm');
  const status = document.getElementById('prayerStatus');
  const refreshBtn = document.getElementById('refreshPrayers');
  const prayerList = document.getElementById('publicPrayerList');
  const answeredList = document.getElementById('answeredPrayerList');

  if (!form || !prayerList || !answeredList) return;

  function setStatus(message, type) {
    if (!status) return;
    status.textContent = message;
    status.className = type === 'error' ? 'prayer-status-error' : 'prayer-status-success';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleDateString('en-IE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function renderItems(container, items, emptyText, answered) {
    if (!items.length) {
      container.innerHTML = `<p class="empty-state">${emptyText}</p>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <article class="prayer-item">
        <p>${escapeHtml(item.message)}</p>
        <footer>
          <span>${escapeHtml(item.name || 'Anonymous')}</span>
          <span>${answered ? '<span class="answered-label">Answered</span> · ' : ''}${formatDate(item.createdAt)}</span>
        </footer>
      </article>
    `).join('');
  }

  async function loadPrayers() {
    try {
      const response = await fetch('/api/prayers');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load prayer wall.');
      renderItems(prayerList, data.prayers || [], 'No public prayer requests yet.', false);
      renderItems(answeredList, data.answered || [], 'No answered prayers shared yet.', true);
    } catch (error) {
      prayerList.innerHTML = '<p class="empty-state">Prayer wall could not load right now.</p>';
      answeredList.innerHTML = '<p class="empty-state">Answered prayers could not load right now.</p>';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = {
      type: String(formData.get('type') || 'prayer'),
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      private: formData.get('private') === 'Yes'
    };

    if (!payload.message) {
      setStatus('Please enter your prayer request or answered prayer.', 'error');
      return;
    }

    if (button) button.disabled = true;
    setStatus('Submitting...', 'success');

    try {
      const response = await fetch('/api/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Submission failed.');

      form.reset();
      setStatus(result.private ? 'Sent privately to Daily Dose. It will not appear on the page.' : 'Shared on the prayer wall. Thank you for letting others pray with you.', 'success');
      await loadPrayers();
    } catch (error) {
      setStatus(error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });

  refreshBtn?.addEventListener('click', loadPrayers);
  loadPrayers();
})();


// Share buttons: automatically share the current page URL for homepage, devotions, and series pages.
(function () {
  function getShareTitle() {
    const h1 = document.querySelector('h1');
    return (h1?.textContent || document.title || 'Daily Dose Devotions').trim();
  }

  function getShareUrl() {
    return window.location.href.split('#')[0];
  }

  function buildShareBlock(label) {
    const url = getShareUrl();
    const title = getShareTitle();
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(title + ' — Daily Dose Devotions');
    const encodedSubject = encodeURIComponent(title);
    const encodedBody = encodeURIComponent('I wanted to share this from Daily Dose Devotions:\n\n' + title + '\n' + url);

    const wrapper = document.createElement('section');
    wrapper.className = 'share-box scheduled-sensitive';
    wrapper.innerHTML = `
      <p class="eyebrow">Share</p>
      <h3>${label}</h3>
      <div class="share-buttons">
        <a class="share-btn" href="https://wa.me/?text=${encodedText}%20${encodedUrl}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">Facebook</a>
        <a class="share-btn" href="mailto:?subject=${encodedSubject}&body=${encodedBody}">Email</a>
        <button class="share-btn copy-share" type="button">Copy Link</button>
      </div>
      <p class="share-note">For Instagram or TikTok, tap Copy Link and paste it into your story, caption, bio, or status.</p>
      <p class="copy-status" aria-live="polite"></p>
    `;

    const copyBtn = wrapper.querySelector('.copy-share');
    const copyStatus = wrapper.querySelector('.copy-status');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyStatus.textContent = 'Link copied.';
      } catch (error) {
        copyStatus.textContent = url;
      }
    });

    return wrapper;
  }

  function addAfterArticle() {
    const article = document.querySelector('.devotion-article');
    if (!article || document.querySelector('.share-box')) return;
    const isSeries = document.body.classList.contains('series-page') || document.querySelector('.series-shell');
    article.insertAdjacentElement('afterend', buildShareBlock(isSeries ? 'Share This Series Reflection' : 'Share This Devotion'));
  }

  function addToArchivePage() {
    if (document.querySelector('.share-box')) return;
    const hero = document.querySelector('.page-hero .container');
    if (!hero) return;
    const path = window.location.pathname;
    if (path.endsWith('/devotions.html') || path.endsWith('/series.html') || path === '/' || path.endsWith('/index.html')) {
      const label = path.endsWith('/series.html') ? 'Share This Series Page' : path.endsWith('/devotions.html') ? 'Share The Devotions Archive' : 'Share Daily Dose Devotions';
      hero.appendChild(buildShareBlock(label));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { addAfterArticle(); addToArchivePage(); });
  } else {
    addAfterArticle();
    addToArchivePage();
  }
})();
