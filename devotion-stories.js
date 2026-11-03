(() => {
  'use strict';
  function init() {
    const article = document.querySelector('.devotion-article');
    if (!article || !article.querySelector('h1') || document.getElementById('dd-story-tools')) return;
    const publishAt = document.body.dataset.publishAt || article.dataset.publishAt;
    if (publishAt && Date.parse(publishAt) > Date.now()) return;
    const title = article.querySelector('h1').textContent.trim();
    const reference = article.querySelector('.scripture-box h3, .scripture-box h2, .scripture-reference, .scripture-heading')?.textContent.trim() || '';
    const link = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
    link.hash = ''; link.searchParams.set('share', 'dd-v8');
    const caption = `${title}\n${reference ? reference + '\n' : ''}\nScripture, prayer and truth for the days you need God most.\nRead the devotion: ${link.href}\n\n#DailyDose #DailyDevotion`;
    const style = document.createElement('style');
    style.textContent = `
      .dd-story-tools{margin:32px 0;padding:24px;border:1px solid #8b764b;border-radius:12px;background:#171715;color:#f6f1e8}
      .dd-story-tools h2{font-size:24px;margin:0 0 8px}.dd-story-tools p{font-size:15px;line-height:1.6;color:#ddd2be}
      .dd-story-actions{display:flex;flex-wrap:wrap;gap:10px}.dd-story-tools button,.dd-story-dialog button,.dd-story-dialog a.dd-download{border:1px solid #9e874f;border-radius:8px;background:#e7d3a1;color:#171715;padding:12px 16px;font:600 14px Arial,sans-serif;cursor:pointer;text-decoration:none;min-height:44px}
      .dd-story-tools button:focus-visible,.dd-story-dialog button:focus-visible,.dd-story-dialog a:focus-visible{outline:3px solid #e9bb54;outline-offset:4px}
      .dd-story-dialog{box-sizing:border-box;width:min(92vw,720px);max-height:90dvh;overflow:auto;border:1px solid #9e874f;border-radius:14px;padding:24px;background:#f8f5ef;color:#20201d}
      .dd-story-dialog::backdrop{background:rgba(0,0,0,.75)}.dd-story-dialog h2{font-size:24px;margin:0 0 12px;color:#20201d}.dd-story-dialog p{font:15px/1.6 Arial,sans-serif;color:#49463e}
      .dd-story-dialog [hidden]{display:none!important}.dd-story-preview{display:block;width:100%;max-width:640px;height:auto;margin:16px auto;border-radius:8px}.dd-story-dialog .dd-close{float:right;background:transparent;border-color:#aaa;color:#222;margin:0 0 12px 12px}
      .dd-story-dialog button:disabled{opacity:.55;cursor:wait}.dd-story-dialog textarea{box-sizing:border-box;width:100%;min-height:110px;background:white;color:#222;border:1px solid #aaa;border-radius:6px;padding:10px;font:14px/1.5 Arial,sans-serif}
    `;
    document.head.append(style);
    const tools = document.createElement('section');
    tools.id = 'dd-story-tools'; tools.className = 'dd-story-tools scheduled-sensitive';
    tools.innerHTML = '<h2>Share this devotion</h2><p>The familiar Daily Dose card, with a direct link to this devotion. Save the card for your story, then add the link so people can read it.</p><div class="dd-story-actions"><button type="button" class="dd-open-card">Card &amp; story link</button><button type="button" class="dd-quick-link">Copy devotion link</button></div><p class="dd-quick-status" role="status" aria-live="polite"></p>';
    article.append(tools);
    // Replace the old link-only Instagram action, keeping WhatsApp, Facebook and copy-link tools intact.
    function cleanLegacySharing() {
      document.querySelectorAll('.instagram-share').forEach(button => button.remove());
      document.querySelectorAll('.share-note').forEach(note => {
        if (note.textContent.includes('Instagram')) note.textContent = 'For Stories and TikTok photos, use Card & story link on this page.';
      });
    }
    cleanLegacySharing();
    // Older page scripts can insert their share toolbar after this script runs.
    new MutationObserver(cleanLegacySharing).observe(document.body, {childList:true, subtree:true});
    const dialog = document.createElement('dialog');
    dialog.className = 'dd-story-dialog'; dialog.setAttribute('aria-labelledby', 'dd-story-heading');
    dialog.innerHTML = '<button class="dd-close" type="button" aria-label="Close story preview">Close</button><h2 id="dd-story-heading">Your card and devotion link</h2><p class="dd-instructions">1. Save the card. 2. Copy the devotion link. 3. In Instagram, create a Story with the card, choose Stickers → Link, paste the link, and label it “Read the devotion”.</p><div class="dd-story-actions"><a class="dd-download" hidden>1. Save card</a><button type="button" class="dd-copy-link">2. Copy devotion link</button><button type="button" class="dd-share-image" disabled>Share image…</button><button type="button" class="dd-copy-caption">Copy caption</button></div><p class="dd-story-status" role="status" aria-live="polite"></p><img class="dd-story-preview" alt="Daily Dose sharing card with the devotion title" hidden><label for="dd-devotion-url">Direct link to this devotion</label><textarea id="dd-devotion-url" aria-label="Direct devotion link" readonly></textarea><p><strong>Facebook:</strong> the Facebook share button on the devotion shares a clickable link. For a Story, add the saved card and a Link sticker if your account offers it.</p><p><strong>TikTok:</strong> upload the card as a photo post and copy the caption. A URL written in the image or caption is not a clickable devotion button. Use a website/profile link only if your account offers that option.</p><p>Saving or sharing the image does not add a clickable link automatically. These tools do not open Instagram Stories directly.</p>';
    document.body.append(dialog);
    dialog.querySelector('textarea').value = link.href;
    const status = dialog.querySelector('.dd-story-status');
    const preview = dialog.querySelector('img');
    const shareButton = dialog.querySelector('.dd-share-image');
    const download = dialog.querySelector('.dd-download');
    let file, imageUrl, preparing;
    dialog.querySelector('.dd-close').onclick = () => dialog.close();
    function wrap(ctx, text, width) {
      const lines = []; let line = '';
      for (const word of text.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line); return lines;
    }
    async function prepare() {
      // Reuse the exact WhatsApp artwork; add the devotion details underneath,
      // like a link-preview card, rather than inventing another logo or design.
      const artwork = new Image();
      await new Promise((resolve, reject) => { artwork.onload = resolve; artwork.onerror = reject; artwork.src = '/daily-dose-share-v8.jpg?v=dd-v8'; });
      const canvas = document.createElement('canvas'); canvas.width = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      let size = 62, lines;
      do { ctx.font = size + 'px Georgia,serif'; lines = wrap(ctx, title, 1040); if (lines.length <= 4 && lines.every(l => ctx.measureText(l).width <= 1040)) break; size -= 2; } while (size > 24);
      const lineHeight = size * 1.22;
      ctx.font = '28px Arial';
      const refs = reference ? wrap(ctx, reference, 1040) : [];
      const footerHeight = 160 + lines.length * lineHeight + refs.length * 38;
      canvas.height = Math.ceil(630 + footerHeight);
      ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(artwork, 0, 0, 1200, 630);
      ctx.textAlign = 'left'; ctx.fillStyle = '#f4ead7'; ctx.font = size + 'px Georgia,serif';
      let y = 700;
      lines.forEach(line => { ctx.fillText(line, 80, y); y += lineHeight; });
      ctx.fillStyle = '#d9bb77'; ctx.font = '28px Arial';
      refs.forEach(line => { ctx.fillText(line, 80, y + 8); y += 38; });
      ctx.font = '25px Arial'; ctx.fillStyle = '#c5c0b5';
      ctx.fillText('Read the devotion · dailydosedevotions.ie', 80, canvas.height - 42);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Image unavailable');
      file = new File([blob], 'daily-dose-' + (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').slice(0, 70) || 'card') + '.png', {type:'image/png'});
      imageUrl = URL.createObjectURL(blob); preview.src = imageUrl; preview.hidden = false;
      download.href = imageUrl; download.download = file.name; download.hidden = false;
      shareButton.disabled = false; status.textContent = 'Your full-size card is ready. Remember to add the devotion link separately.';
    }
    async function openCard() {
      dialog.showModal();
      if (!file) {
        status.textContent = 'Preparing your card…';
        try { if (!preparing) preparing = prepare(); await preparing; }
        catch (error) { console.error('Story card generation failed', error); preparing = null; status.textContent = 'The card could not load. You can still copy the devotion link below.'; }
      }
    }
    tools.querySelector('.dd-open-card').onclick = openCard;
    tools.querySelector('.dd-quick-link').onclick = async () => {
      try { await navigator.clipboard.writeText(link.href); tools.querySelector('.dd-quick-status').textContent = 'Devotion link copied. In Instagram Stories, paste it into a Link sticker.'; }
      catch { await openCard(); const field = dialog.querySelector('textarea'); field.value = link.href; field.focus(); field.select(); status.textContent = 'Select and copy the devotion link below.'; }
    };
    shareButton.onclick = async () => {
      if (!file) return;
      if (!navigator.canShare || !navigator.canShare({files:[file]})) {
        status.textContent = 'This browser cannot share image files directly. Use Save card, then upload it in the app.'; return;
      }
      try { await navigator.share({files:[file]}); status.textContent = 'Share menu closed. Finish your post in the app you chose.'; }
      catch (error) { status.textContent = error.name === 'AbortError' ? 'Sharing cancelled. Your card is still ready.' : 'Your phone could not share this image. Save it and upload it in the app instead.'; }
    };
    async function copy(text, message) {
      try { await navigator.clipboard.writeText(text); status.textContent = message; }
      catch { const field = dialog.querySelector('textarea'); field.hidden = false; field.value = text; field.focus(); field.select(); status.textContent = 'Select and copy the text below.'; }
    }
    dialog.querySelector('.dd-copy-caption').onclick = () => copy(caption, 'Caption copied. Paste it into your post. Add the clickable devotion link separately.');
    dialog.querySelector('.dd-copy-link').onclick = () => copy(link.href, 'Devotion link copied. In Instagram Stories, choose Stickers → Link and paste it there.');
    window.addEventListener('pagehide', event => { if (!event.persisted && imageUrl) URL.revokeObjectURL(imageUrl); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();