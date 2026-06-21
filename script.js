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
  window.dailyDoseScheduledDevotions = [];

  document.querySelectorAll('[data-publish-at]').forEach(el => {
    const publishAt = new Date(el.getAttribute('data-publish-at'));
    if (now < publishAt) {
      if (el.classList.contains('devotion-card')) {
        window.dailyDoseScheduledDevotions.push({
          text: el.textContent,
          publishAt: el.getAttribute('data-publish-at')
        });
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

const DEVOTION_THEME_TERMS = {
  1: 'purpose direction searching questions spiritual hunger missing something meaning',
  2: 'identity known by God belonging worth name personal relationship',
  3: 'love grace God love acceptance forgiveness mercy',
  4: 'confidence identity trust security courage faith fear',
  5: 'identity new identity in Christ transformation old self new self worth',
  6: 'calling identity purpose set apart created by God belonging',
  7: 'clarity perspective vision discernment wisdom seeing clearly',
  8: 'struggle suffering weakness comfort endurance God sees you',
  9: 'anxiety worry peace fear pressure mental health trust',
  10: 'control surrender trust uncertainty anxiety faith letting go',
  11: 'drift drifting consistency discipline focus returning to God',
  12: 'heart motives honesty repentance surrender search your heart',
  13: 'direction repentance change surrender new path obedience',
  14: 'discipline focus reset recovery getting back on track consistency',
  15: 'rise courage obedience faith movement breakthrough',
  16: 'faith courage obedience calling take hold uncertainty',
  17: 'following Jesus discipleship obedience consistency commitment',
  18: 'connection vine abiding Jesus fruitfulness spiritual growth',
  19: 'consistency discipline faithfulness perseverance habits',
  20: 'heart motives character wisdom response emotions',
  21: 'opportunity purpose obedience calling faithfulness',
  22: 'abundant life surrender obedience life in Christ freedom',
  23: 'waiting progress patience trust God working process',
  24: 'doubt confidence courage encouragement strength faith',
  25: 'focus thoughts mindset attention growth discipline',
  26: 'weakness strength endurance comfort dependence God help',
  27: 'process trust patience waiting faithfulness growth',
  28: 'faithfulness consistency grace God faithful restoration',
  29: 'past temptation moving forward repentance recovery don\'t go back',
  30: 'perseverance endurance keep going consistency encouragement',
  31: 'thirst desire satisfaction emptiness Jesus living water',
  32: 'repentance seeking God opportunity urgency return to God',
  33: 'obedience humility surrender healing Naaman breakthrough',
  34: 'seeking desire choices direction wisdom doors',
  35: 'identity worth freedom slave son daughter who you are',
  36: 'unknown trust faithfulness uncertainty patience',
  37: 'light honesty repentance confession truth healing',
  38: 'God character truth feelings disappointment faith',
  39: 'love grace receiving love identity acceptance',
  40: 'truth feelings mindset thinking renewal obedience',
  41: 'narrow path obedience discipleship choices sacrifice',
  42: 'faith sacrifice obedience narrow path endurance',
  43: 'shaken security hope foundation trust stability',
  44: 'calling discipleship obedience cross surrender',
  45: 'blindness healing spiritual sight obedience Jesus',
  46: 'rooted Jesus fruitfulness connection growth blessing',
  47: 'lost found grace shepherd shame return to God',
  48: 'lordship surrender obedience Jesus Lord priorities',
  49: 'seek first priorities heart kingdom focus',
  50: 'life Jesus answer identity satisfaction purpose',
  51: 'identity new self transformation holiness following Jesus',
  52: 'prayer relationship honesty intimacy God conversation',
  53: 'invitation grace salvation table welcome return',
  54: 'God working progress faithfulness perseverance hope',
  55: 'healing Jesus sees you mercy faith Bartimaeus',
  56: 'past temptation moving forward surrender don\'t go back',
  57: 'shame hiding confession grace healing return',
  58: 'voice guidance discernment obedience shepherd listening',
  59: 'heart coldness drift passion return repentance',
  60: 'waiting patience trust delay faith process',
  61: 'drift warning attention faithfulness perseverance'
};

const SEARCH_TERM_ALIASES = {
  idfentity: 'identity',
  identiy: 'identity',
  identidy: 'identity',
  anxity: 'anxiety',
  forgivness: 'forgiveness',
  obediance: 'obedience',
  prayr: 'prayer'
};

// Devotion archive search.
(function () {
  const search = document.getElementById('devotionSearch');
  const grid = document.getElementById('archiveGrid');
  const empty = document.getElementById('noSearchResults');
  if (!search || !grid) return;

  const cards = Array.from(grid.querySelectorAll('.devotion-card'));
  const cardSearchText = new Map(cards.map(card => [card, buildDevotionSearchText(card)]));
  const scheduledSearchText = (window.dailyDoseScheduledDevotions || []).map(item => {
    const dateTerms = buildDateTerms(item.publishAt);
    return normalizeSearchText([item.text, dateTerms].join(' '));
  });

  search.addEventListener('input', () => {
    const term = normalizeSearchText(search.value);
    let shown = 0;

    cards.forEach(card => {
      const matches = !term || cardSearchText.get(card).includes(term);
      card.hidden = !matches;
      if (matches) shown += 1;
    });

    if (empty) {
      if (!term || shown > 0) {
        empty.hidden = true;
      } else {
        const scheduledMatch = scheduledSearchText.some(text => text.includes(term));
        empty.textContent = scheduledMatch
          ? 'That devotion is scheduled but is not available yet. Please check back on its release date.'
          : 'No devotions matched your search. Try a title, date, Scripture, or theme such as identity, prayer, anxiety, obedience, faith, or healing.';
        empty.hidden = false;
      }
    }
  });

  function buildDevotionSearchText(card) {
    const number = getDevotionNumber(card);
    const publishAt = card.getAttribute('data-publish-at');
    const visibleDate = card.querySelector('.date')?.textContent || '';
    const themeTerms = DEVOTION_THEME_TERMS[number] || '';
    return normalizeSearchText([
      card.textContent,
      visibleDate,
      buildDateTerms(publishAt || visibleDate),
      themeTerms
    ].join(' '));
  }

  function getDevotionNumber(card) {
    const match = card.textContent.match(/Daily Dose\s*#(\d+)/i);
    return match ? match[1] : '';
  }

  function buildDateTerms(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const day = parsed.getUTCDate();
    const month = parsed.getUTCMonth() + 1;
    const year = parsed.getUTCFullYear();
    const shortMonth = parsed.toLocaleString('en-IE', { month: 'short', timeZone: 'UTC' });
    const longMonth = parsed.toLocaleString('en-IE', { month: 'long', timeZone: 'UTC' });
    const paddedDay = String(day).padStart(2, '0');
    const paddedMonth = String(month).padStart(2, '0');

    return [
      `${shortMonth} ${day} ${year}`,
      `${longMonth} ${day} ${year}`,
      `${day} ${shortMonth} ${year}`,
      `${day} ${longMonth} ${year}`,
      `${paddedDay}/${paddedMonth}/${year}`,
      `${day}/${month}/${year}`,
      `${paddedDay}-${paddedMonth}-${year}`,
      `${day}-${month}-${year}`,
      `${year}-${paddedMonth}-${paddedDay}`
    ].join(' ');
  }

  function normalizeSearchText(value) {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/&mdash;|—/g, ' ')
      .replace(/&ndash;|–/g, ' ')
      .replace(/&rsquo;|&lsquo;|’|‘/g, "'")
      .replace(/&ldquo;|&rdquo;|“|”/g, '"')
      .replace(/[^a-z0-9/ -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return SEARCH_TERM_ALIASES[normalized] || normalized;
  }
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
