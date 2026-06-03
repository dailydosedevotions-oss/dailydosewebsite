const navbar = document.getElementById('navbar');
const menu = document.getElementById('mobileMenu');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
});

menuBtn?.addEventListener('click', () => menu.classList.add('open'));
closeBtn?.addEventListener('click', () => menu.classList.remove('open'));

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      menu.classList.remove('open');
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
