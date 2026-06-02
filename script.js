const navbar = document.getElementById('navbar');
const menu = document.getElementById('mobileMenu');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    if (button) button.disabled = true;
    if (status) status.textContent = 'Subscribing...';

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong. Please try again.');
      }

      form.reset();
      if (status) status.textContent = 'Thank you for subscribing. Please check your inbox for the Welcome Pack.';
    } catch (error) {
      if (status) status.textContent = error.message || 'Something went wrong. Please try again.';
    } finally {
      if (button) button.disabled = false;
    }
  });
})();
