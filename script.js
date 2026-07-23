const navbar = document.getElementById('navbar');
const menu = document.getElementById('mobileMenu');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
});

function setMenuOpen(isOpen) {
  menu?.classList.toggle('open', isOpen);
  menuBtn?.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
}

menuBtn?.setAttribute('aria-expanded', 'false');
menuBtn?.addEventListener('click', () => setMenuOpen(true));
closeBtn?.addEventListener('click', () => setMenuOpen(false));
menu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => setMenuOpen(false));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.classList.contains('open')) setMenuOpen(false);
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    setMenuOpen(false);
    target.scrollIntoView({ behavior: 'smooth' });
    if (link.classList.contains('skip-link')) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
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
    if (now >= publishAt) return;

    if (el.classList.contains('devotion-card')) {
      el.remove();
      return;
    }

    if (document.body === el) {
      const warning = document.querySelector('.scheduled-warning');
      const body = document.querySelector('.devotion-body');
      if (warning) warning.hidden = false;
      if (body) body.innerHTML = '<p>This devotion is scheduled and will become available at 7am on its release date.</p>';
      document.querySelectorAll('.scheduled-sensitive').forEach(link => link.remove());
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

// Homepage milestone banner: celebrates Daily Dose #100 without needing a manual site change.
(function () {
  const section = document.getElementById('dailyDoseMilestone');
  const eyebrow = document.getElementById('milestoneEyebrow');
  const title = document.getElementById('milestoneTitle');
  const text = document.getElementById('milestoneText');
  const link = document.getElementById('milestoneLink');
  if (!section || !eyebrow || !title || !text || !link) return;

  const now = new Date();
  const buildStart = new Date('2026-07-23T00:00:00+01:00');
  const dayStart = new Date('2026-08-02T00:00:00+01:00');
  const thanksStart = new Date('2026-08-03T00:00:00+01:00');
  const end = new Date('2026-08-06T00:00:00+01:00');
  const daysUntil100 = Math.max(1, Math.ceil((dayStart - now) / (1000 * 60 * 60 * 24)));

  if (now < buildStart || now >= end) return;

  const states = {
    build: {
      eyebrow: '100 Days of Daily Dose',
      title: `${daysUntil100} ${daysUntil100 === 1 ? 'Day' : 'Days'} to 100 Days of Daily Dose`,
      text: 'Daily Dose reaches #100 on Sunday, August 2. We are giving thanks for every day of Scripture, reflection, and real life - one day at a time.',
      href: 'devotions.html',
      label: 'Read Today\u2019s Dose'
    },
    day: {
      eyebrow: 'Today: Daily Dose #100',
      title: '100 Days of Daily Dose',
      text: '100 days of opening the Word, turning back to Christ, and remembering grace. Today\u2019s Daily Dose is #100.',
      href: 'devotions/daily-dose-100.html',
      label: 'Read Daily Dose #100'
    },
    thanks: {
      eyebrow: 'Thank You for 100 Days',
      title: 'Daily Dose Continues One Day at a Time',
      text: 'Thank you for reading, praying, sharing, and walking with us. We keep going in the Word, one day at a time.',
      href: 'devotions.html',
      label: 'Keep Reading'
    }
  };

  const state = now >= thanksStart ? states.thanks : now >= dayStart ? states.day : states.build;
  eyebrow.textContent = state.eyebrow;
  title.textContent = state.title;
  text.textContent = state.text;
  link.href = state.href;
  link.textContent = state.label;
  section.hidden = false;
})();

// Homepage feature: pulls the latest available devotion into the "Today's Daily Dose" card.
(function () {
  const card = document.getElementById('todayDoseCard');
  const title = document.getElementById('todayDoseTitle');
  const date = document.getElementById('todayDoseDate');
  const excerpt = document.getElementById('todayDoseExcerpt');
  const link = document.getElementById('todayDoseLink');
  const heroLink = document.getElementById('heroTodayDevotionLink');
  if (!card || !title || !date || !excerpt || !link) return;

  const now = new Date();

  fetch('/devotions.html')
    .then(response => response.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const devotion = Array.from(doc.querySelectorAll('.devotion-card')).find(item => {
        const publishAt = item.getAttribute('data-publish-at');
        return !publishAt || now >= new Date(publishAt);
      });

      if (!devotion) return;

      const devotionTitle = devotion.querySelector('h3')?.textContent?.trim();
      const devotionDate = devotion.querySelector('.date')?.textContent?.trim();
      const devotionExcerpt = devotion.querySelector('p')?.textContent?.trim();
      const devotionHref = devotion.querySelector('a[href]')?.getAttribute('href');

      if (devotionTitle) title.textContent = devotionTitle;
      if (devotionDate) date.textContent = devotionDate;
      if (devotionExcerpt) excerpt.textContent = devotionExcerpt.replace(/\.\.\.$/, '...');
      if (devotionHref) {
        link.href = devotionHref;
        if (heroLink) heroLink.href = devotionHref;
      }
    })
    .catch(() => {});
})();

// Subscribe landing share helper.
(function () {
  const copyBtn = document.querySelector('.copy-subscribe-link');
  const status = document.getElementById('subscribeCopyStatus');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    const url = 'https://dailydosedevotions.ie/subscribe';
    try {
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = 'Subscribe link copied.';
    } catch {
      if (status) status.textContent = url;
    }
  });
})();

// Scripture highlighting: keeps Bible text visually distinct across old and future devotions.
(function () {
  const article = document.querySelector('.devotion-article');
  const body = document.querySelector('.devotion-body');
  if (!article || !body) return;

  const inlineScriptureStyle = 'color:#9b6100;font-weight:850;font-style:italic;background:transparent;border:0;padding:0;border-radius:0;text-decoration:underline;text-decoration-color:#e0a72e;text-decoration-thickness:2px;text-underline-offset:4px;';
  const referenceLineStyle = 'color:#8a5b00;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin:32px 0 8px;';
  const verseLineStyle = 'color:#7a4d00;font-weight:800;font-style:italic;line-height:1.95;text-decoration:underline;text-decoration-color:#e0a72e;text-decoration-thickness:2px;text-underline-offset:5px;';

  const bibleBooks = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
    'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
    'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
    'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
    'John', 'Acts', 'Romans', 'Corinthians', 'Galatians', 'Ephesians', 'Philippians',
    'Colossians', 'Thessalonians', 'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
    'Peter', 'Jude', 'Revelation'
  ];

  const bookPattern = bibleBooks.join('|');
  const referencePattern = new RegExp('\\b(?:[1-3]\\s*)?(?:' + bookPattern + ')\\s+\\d{1,3}:\\d{1,3}(?:[-–&]\\d{1,3})?(?:\\s*\\([A-Z0-9]+\\))?', 'i');
  const referenceOnlyPattern = new RegExp('^\\s*(?:[1-3]\\s*)?(?:' + bookPattern + ')\\s+\\d{1,3}:\\d{1,3}(?:[-–&]\\d{1,3})?(?:\\s*\\([A-Z0-9]+\\))?\\s*$', 'i');
  const scriptureCuePattern = /\b(?:Scripture|the Bible|Jesus|God|the Lord|Paul|John|Matthew|Mark|Luke|Peter|James)\s+(?:says|said|warns|writes|declares|calls|called|asks|asked|teaches|tells)\b/i;
  const quoteStartPattern = /^\s*(?:["\u201c]|&ldquo;|&quot;)/i;

  article.querySelectorAll('.scripture-box').forEach(box => {
    const heading = box.querySelector('h3');
    const verse = box.querySelector('p');
    if (heading) heading.setAttribute('style', mergeStyle(heading, referenceLineStyle + 'margin:0 0 12px;'));
    if (verse) verse.setAttribute('style', mergeStyle(verse, verseLineStyle + 'margin:0;'));
  });

  body.querySelectorAll('blockquote').forEach(blockquote => {
    blockquote.classList.add('scripture-quote-block');
  });

  const paragraphs = Array.from(body.querySelectorAll('p'));

  paragraphs.forEach((paragraph, index) => {
    if (paragraph.closest('.scripture-inline')) return;

    const text = (paragraph.textContent || '').trim();
    const previousText = (paragraphs[index - 1]?.textContent || '').trim();
    const nextParagraph = paragraphs[index + 1];

    if (referenceOnlyPattern.test(text)) {
      paragraph.classList.add('scripture-reference-line');
      paragraph.setAttribute('style', mergeStyle(paragraph, referenceLineStyle));

      if (nextParagraph && quoteStartPattern.test(nextParagraph.textContent || '')) {
        nextParagraph.classList.add('scripture-quoted-line');
        nextParagraph.setAttribute('style', mergeStyle(nextParagraph, verseLineStyle));
      }
      return;
    }

    if (quoteStartPattern.test(text) && referenceOnlyPattern.test(previousText)) {
      paragraph.classList.add('scripture-quoted-line');
      paragraph.setAttribute('style', mergeStyle(paragraph, verseLineStyle));
      return;
    }

    if (!referencePattern.test(text) && !scriptureCuePattern.test(text)) return;
    highlightQuotedText(paragraph);
  });

  function highlightQuotedText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !/["\u201c]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.scripture-inline')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      const text = node.nodeValue;
      const quotePattern = /(["\u201c])([^"\u201d]{4,360})(["\u201d])/g;
      let lastIndex = 0;
      let match;
      let changed = false;

      while ((match = quotePattern.exec(text))) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const span = document.createElement('span');
        span.className = 'scripture-inline';
        span.setAttribute('style', inlineScriptureStyle);
        span.textContent = match[0];
        fragment.appendChild(span);
        lastIndex = match.index + match[0].length;
        changed = true;
      }

      if (!changed) return;
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      node.parentNode.replaceChild(fragment, node);
    });
  }

  function mergeStyle(element, style) {
    const current = element.getAttribute('style');
    return current ? `${current};${style}` : style;
  }
})();

// Subscribe form: sends new subscribers to Brevo through Cloudflare Pages Functions.
(function () {
  const form = document.getElementById('subscribeForm');
  const status = document.getElementById('subscribeStatus');
  if (!form) return;

  form.setAttribute('action', '#');
  form.setAttribute('novalidate', 'novalidate');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();

    const button = form.querySelector('button[type="submit"]');
    const originalButtonText = button?.dataset.originalText || button?.textContent || 'Subscribe to Daily Dose';
    if (button) button.dataset.originalText = originalButtonText;

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
      const response = await fetch('/api/subscribe', { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) throw new Error(result.error || 'Something went wrong. Please try again.');

      form.reset();
      if (status) status.textContent = 'Thank you for subscribing. Please check your inbox for the Welcome Pack.';
      if (button) button.textContent = 'Subscribed';
    } catch (error) {
      if (status) status.textContent = error.message || 'Something went wrong. Please try again.';
      if (button) button.textContent = originalButtonText;
    } finally {
      if (button) {
        setTimeout(() => {
          button.disabled = false;
          if (button.textContent === 'Subscribed') button.textContent = originalButtonText;
        }, 2500);
      }
    }

    return false;
  });
})();

// Prayer wall: public submissions are reviewed before appearing; private ones email Daily Dose only.
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
      return new Date(value).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
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
          <span>${answered ? '<span class="answered-label">Answered</span> &middot; ' : ''}${formatDate(item.createdAt)}</span>
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
    } catch {
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
      setStatus(result.private ? 'Sent privately to Daily Dose. It will not appear on the page.' : 'Sent to Daily Dose for review. If approved, it may appear on the prayer wall.', 'success');
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

// Share buttons use the current page URL for homepage, devotions, and series pages.
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
    const encodedText = encodeURIComponent(title + ' - Daily Dose Devotions');
    const encodedSubject = encodeURIComponent(title);
    const encodedBody = encodeURIComponent('I wanted to share this from Daily Dose Devotions:\n\n' + title + '\n' + url);

    const wrapper = document.createElement('section');
    wrapper.className = 'share-box scheduled-sensitive';
    wrapper.innerHTML = `
      <p class="eyebrow">Share</p>
      <h3>${label}</h3>
      <div class="share-buttons">
        <button class="share-btn native-share" type="button">Share</button>
        <button class="share-btn instagram-share" type="button">Instagram / Stories</button>
        <a class="share-btn" href="https://wa.me/?text=${encodedText}%20${encodedUrl}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">Facebook</a>
        <a class="share-btn" href="mailto:?subject=${encodedSubject}&body=${encodedBody}">Email</a>
        <button class="share-btn copy-share" type="button">Copy Link</button>
      </div>
      <p class="share-note">For Instagram Stories, tap Instagram / Stories on your phone. If Instagram does not appear, copy the link and add it manually.</p>
      <p class="copy-status" aria-live="polite"></p>
    `;

    const nativeBtn = wrapper.querySelector('.native-share');
    const instagramBtn = wrapper.querySelector('.instagram-share');
    const copyBtn = wrapper.querySelector('.copy-share');
    const copyStatus = wrapper.querySelector('.copy-status');

    async function nativeShare(intent) {
      const shareData = { title, text: `I wanted to share this from Daily Dose Devotions:\n\n${title}`, url };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
          copyStatus.textContent = intent === 'instagram' ? 'Share opened. Choose Instagram or Stories if it appears.' : 'Share opened.';
        } else {
          await navigator.clipboard.writeText(url);
          copyStatus.textContent = 'Link copied. Open Instagram and paste it into your story.';
        }
      } catch {
        copyStatus.textContent = 'Share cancelled. Link copied if you need it.';
        try {
          await navigator.clipboard.writeText(url);
        } catch {}
      }
    }

    nativeBtn?.addEventListener('click', () => nativeShare('native'));
    instagramBtn?.addEventListener('click', () => nativeShare('instagram'));

    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyStatus.textContent = 'Link copied.';
      } catch {
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
    if (path.endsWith('/devotions.html') || path.endsWith('/series.html') || path.endsWith('/series/formed.html') || path === '/' || path.endsWith('/index.html')) {
      const label = path.endsWith('/series/formed.html') ? 'Share This FORMED Series' : path.endsWith('/series.html') ? 'Share This Series Page' : path.endsWith('/devotions.html') ? 'Share The Devotions Archive' : 'Share Daily Dose Devotions';
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
