(() => {
  const url = 'https://dailydosedevotions.ie/subscribe';
  const status = document.getElementById('signupShareStatus');
  const fallback = document.getElementById('signupLinkFallback');
  async function copy() {
    try { await navigator.clipboard.writeText(url); fallback.hidden = true; status.textContent = 'Signup link copied. Ready to send to a friend.'; }
    catch { fallback.hidden = false; fallback.focus(); fallback.select(); status.textContent = 'Select and copy this signup link.'; }
  }
  document.getElementById('copySignupLink').addEventListener('click', copy);
  document.getElementById('shareSignupLink').addEventListener('click', async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({title:'Get Daily Dose by email — free', text:'A little encouragement each morning. Get free daily devotions from Daily Dose.', url});
      status.textContent = '';
    } catch (error) { if (error.name !== 'AbortError') await copy(); }
  });
})();