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
    link.hash = ''; link.searchParams.set('share', 'dd-v7');
    const caption = `${title}\n${reference ? reference + '\n' : ''}\nScripture, prayer and truth for the days you need God most.\nRead the devotion: ${link.href}\n\n#DailyDose #DailyDevotion`;
    const style = document.createElement('style');
    style.textContent = `
      .dd-story-tools{margin:32px 0;padding:24px;border:1px solid #8b764b;border-radius:12px;background:#171715;color:#f6f1e8}
      .dd-story-tools h2{font-size:24px;margin:0 0 8px}.dd-story-tools p{font-size:15px;line-height:1.6;color:#ddd2be}
      .dd-story-actions{display:flex;flex-wrap:wrap;gap:10px}.dd-story-tools button,.dd-story-dialog button,.dd-story-dialog a.dd-download{border:1px solid #9e874f;border-radius:8px;background:#e7d3a1;color:#171715;padding:12px 16px;font:600 14px Arial,sans-serif;cursor:pointer;text-decoration:none;min-height:44px}
      .dd-story-tools button:focus-visible,.dd-story-dialog button:focus-visible,.dd-story-dialog a:focus-visible{outline:3px solid #e9bb54;outline-offset:4px}
      .dd-story-dialog{box-sizing:border-box;width:min(92vw,720px);max-height:90dvh;overflow:auto;border:1px solid #9e874f;border-radius:14px;padding:24px;background:#f8f5ef;color:#20201d}
      .dd-story-dialog::backdrop{background:rgba(0,0,0,.75)}.dd-story-dialog h2{font-size:24px;margin:0 0 12px;color:#20201d}.dd-story-dialog p{font:15px/1.6 Arial,sans-serif;color:#49463e}
      .dd-story-dialog [hidden]{display:none!important}.dd-story-preview{display:block;width:min(100%,240px);height:auto;margin:16px auto;border-radius:8px}.dd-story-dialog .dd-close{float:right;background:transparent;border-color:#aaa;color:#222;margin:0 0 12px 12px}
      .dd-story-dialog button:disabled{opacity:.55;cursor:wait}.dd-story-dialog textarea{box-sizing:border-box;width:100%;min-height:110px;background:white;color:#222;border:1px solid #aaa;border-radius:6px;padding:10px;font:14px/1.5 Arial,sans-serif}
    `;
    document.head.append(style);
    const tools = document.createElement('section');
    tools.id = 'dd-story-tools'; tools.className = 'dd-story-tools scheduled-sensitive';
    tools.innerHTML = '<h2>Take this encouragement further</h2><p>Create a story card for Instagram, Facebook or a TikTok photo post. Keep the devotion close, or share it with someone who needs it.</p><div class="dd-story-actions"><button type="button" data-platform="Instagram">Instagram Stories</button><button type="button" data-platform="Facebook">Facebook Stories</button><button type="button" data-platform="TikTok">TikTok photo</button><button type="button" data-platform="Save">Save story card</button></div>';
    article.append(tools);
    // Replace the old link-only Instagram action, keeping WhatsApp, Facebook and copy-link tools intact.
    document.querySelectorAll('.instagram-share').forEach(button => button.remove());
    document.querySelectorAll('.share-note').forEach(note => {
      if (note.textContent.includes('Instagram')) note.textContent = 'For Stories and TikTok photos, use the story-card options on this page.';
    });
    const dialog = document.createElement('dialog');
    dialog.className = 'dd-story-dialog'; dialog.setAttribute('aria-labelledby', 'dd-story-heading');
    dialog.innerHTML = '<button class="dd-close" type="button" aria-label="Close story preview">Close</button><h2 id="dd-story-heading">Your story card</h2><p class="dd-instructions"></p><img class="dd-story-preview" alt="Portrait Daily Dose story card" hidden><p class="dd-story-status" role="status" aria-live="polite"></p><div class="dd-story-actions"><button type="button" class="dd-share-image" disabled>Share image</button><a class="dd-download" hidden>Download image</a><button type="button" class="dd-copy-caption">Copy caption</button><button type="button" class="dd-copy-link">Copy devotion link</button></div><textarea aria-label="Text to copy" readonly hidden></textarea><p>The image does not contain a clickable link. On Instagram or Facebook, add a Link sticker using “Copy devotion link” if that option is available. On TikTok, paste the caption and add the photo in the app.</p>';
    document.body.append(dialog);
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
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#111310'; ctx.fillRect(0, 0, 1080, 1920);
      ctx.strokeStyle = '#ad9255'; ctx.lineWidth = 2; ctx.strokeRect(60, 60, 960, 1800);
      const logo = new Image();
      await new Promise((resolve, reject) => { logo.onload = resolve; logo.onerror = reject; logo.src = '/icons/brand-mark-v3.png'; });
      ctx.drawImage(logo, 410, 170, 260, 260);
      ctx.textAlign = 'center'; ctx.fillStyle = '#dfc78d'; ctx.font = '500 32px Arial';
      ctx.fillText('D A I L Y   D O S E', 540, 490);
      ctx.fillStyle = '#f8f3e9';
      let size = 86, lines;
      do { ctx.font = `${size}px Georgia,serif`; lines = wrap(ctx, title, 830); if (lines.length <= 6 && lines.every(l => ctx.measureText(l).width <= 830)) break; size -= 2; } while (size > 24);
      const lineHeight = size * 1.2;
      const start = 840 - ((lines.length - 1) * lineHeight / 2);
      lines.forEach((line, i) => ctx.fillText(line, 540, start + i * lineHeight));
      ctx.strokeStyle = '#ad9255'; ctx.beginPath(); ctx.moveTo(410, 1210); ctx.lineTo(670, 1210); ctx.stroke();
      ctx.fillStyle = '#dfc78d'; ctx.font = '30px Arial';
      wrap(ctx, reference, 820).forEach((line, i) => ctx.fillText(line, 540, 1300 + i * 42));
      ctx.fillStyle = '#eee6d7'; ctx.font = '36px Georgia,serif';
      ctx.fillText('For the days you need God most.', 540, 1480);
      ctx.font = '25px Arial'; ctx.fillStyle = '#c7bda9';
      ctx.fillText('SCRIPTURE  ·  PRAYER  ·  TRUTH', 540, 1550);
      ctx.font = '29px Arial'; ctx.fillStyle = '#dfc78d';
      ctx.fillText('Read the devotion', 540, 1690); ctx.fillText('dailydosedevotions.ie', 540, 1740);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Image unavailable');
      file = new File([blob], 'daily-dose-' + (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70) || 'story') + '.png', {type:'image/png'});
      imageUrl = URL.createObjectURL(blob); preview.src = imageUrl; preview.hidden = false;
      download.href = imageUrl; download.download = file.name; download.hidden = false;
      shareButton.disabled = false; status.textContent = 'Your 1080 × 1920 story card is ready.';
    }
    tools.querySelectorAll('button').forEach(button => button.onclick = async () => {
      const platform = button.dataset.platform;
      dialog.querySelector('.dd-instructions').textContent = platform === 'Save' ? 'Download your card to keep it, or upload it in your favourite social app.' : `Tap Share image and choose ${platform} if your phone offers it. If Stories or ${platform} is missing, download the image, open ${platform}, and choose ${platform === 'TikTok' ? 'a new photo post' : 'Create story'} to upload it. On iPhone, you may need to save the downloaded image to Photos first.`;
      dialog.showModal();
      if (!file) {
        status.textContent = 'Preparing your story card…';
        try { if (!preparing) preparing = prepare(); await preparing; }
        catch (error) { console.error('Story card generation failed', error); preparing = null; status.textContent = 'The card could not load. Close this preview and try again, or copy the devotion link below.'; }
      }
    });
    shareButton.onclick = async () => {
      if (!file) return;
      if (!navigator.canShare || !navigator.canShare({files:[file]})) {
        status.textContent = 'This browser cannot share image files directly. Use Download image, then upload it in the app.'; return;
      }
      try { await navigator.share({files:[file]}); status.textContent = 'Share menu closed. Finish your post in the app you chose.'; }
      catch (error) { status.textContent = error.name === 'AbortError' ? 'Sharing cancelled. Your card is still ready.' : 'Your phone could not share this image. Download it and upload it in the app instead.'; }
    };
    async function copy(text) {
      try { await navigator.clipboard.writeText(text); status.textContent = 'Copied. Paste it into your story or post.'; }
      catch { const field = dialog.querySelector('textarea'); field.hidden = false; field.value = text; field.focus(); field.select(); status.textContent = 'Select and copy the text below.'; }
    }
    dialog.querySelector('.dd-copy-caption').onclick = () => copy(caption);
    dialog.querySelector('.dd-copy-link').onclick = () => copy(link.href);
    window.addEventListener('pagehide', event => { if (!event.persisted && imageUrl) URL.revokeObjectURL(imageUrl); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();