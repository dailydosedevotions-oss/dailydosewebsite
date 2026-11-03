(() => {
  'use strict';
  function init() {
    const article = document.querySelector('.devotion-article');
    if (!article?.querySelector('h1') || document.getElementById('dd-story-tools')) return;
    const publishAt = document.body.dataset.publishAt || article.dataset.publishAt;
    if (publishAt && Date.parse(publishAt) > Date.now()) return;
    const title = article.querySelector('h1').textContent.trim();
    const reference = article.querySelector('.scripture-box h3, .scripture-box h2, .scripture-reference, .scripture-heading')?.textContent.trim() || '';
    const link = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
    link.hash = ''; link.searchParams.set('share', 'dd-v8');
    const style = document.createElement('style');
    style.textContent = `
      #dd-story-tools{margin:32px 0;padding:24px;border-top:1px solid #b49b68;background:transparent;color:inherit}
      #dd-story-tools h2{font:400 24px Georgia,serif;margin:0 0 16px;color:inherit}
      #dd-story-tools .dd-actions{display:flex;flex-wrap:wrap;gap:10px}
      #dd-story-tools .dd-action{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;border:1px solid #aa915b;border-radius:6px;background:transparent;color:inherit;font:600 14px Arial,sans-serif;text-decoration:none;cursor:pointer}
      #dd-story-tools .dd-action:first-child{background:#dfc58c;color:#191711}
      #dd-story-tools .dd-action:focus-visible{outline:3px solid #b99542;outline-offset:3px}
      #dd-story-tools .dd-action:disabled{opacity:.6;cursor:wait}
      #dd-story-tools .dd-status{font:14px/1.5 Arial,sans-serif;margin:12px 0 0}
      #dd-story-tools .dd-status:empty{display:none}
      #dd-story-tools textarea{box-sizing:border-box;width:100%;margin-top:12px;padding:12px}
      #dd-story-tools [hidden]{display:none!important}
      @media(max-width:480px){#dd-story-tools{padding:20px 0}#dd-story-tools .dd-actions{display:grid;grid-template-columns:1fr 1fr}}
    `;
    document.head.append(style);
    const section=document.createElement('section');
    section.id='dd-story-tools'; section.className='share-box scheduled-sensitive';
    section.innerHTML='<h2>Share this devotion</h2><div class="dd-actions"><a class="dd-action dd-whatsapp" target="_blank" rel="noopener">WhatsApp</a><button class="dd-action dd-share" type="button">Share</button><button class="dd-action dd-copy" type="button">Copy link</button><button class="dd-action dd-save" type="button">Save image</button></div><p class="dd-status" role="status" aria-live="polite"></p><textarea aria-label="Devotion link" readonly hidden></textarea>';
    article.append(section);
    section.querySelector('.dd-whatsapp').href='https://wa.me/?text='+encodeURIComponent(title+'\n'+link.href);
    const status=section.querySelector('.dd-status');
    const field=section.querySelector('textarea'); field.value=link.href;
    function cleanDuplicates(){document.querySelectorAll('.share-box:not(#dd-story-tools)').forEach(el=>el.remove());}
    cleanDuplicates();
    new MutationObserver(cleanDuplicates).observe(document.body,{childList:true,subtree:true});
    async function copyLink(){
      try{await navigator.clipboard.writeText(link.href);field.hidden=true;status.textContent='Link copied.';}
      catch{field.hidden=false;field.focus();field.select();status.textContent='Select and copy the link below.';}
    }
    section.querySelector('.dd-copy').onclick=copyLink;
    section.querySelector('.dd-share').onclick=async()=>{
      if(!navigator.share){await copyLink();return;}
      try{await navigator.share({title,url:link.href});status.textContent='';}
      catch(error){if(error.name!=='AbortError')await copyLink();}
    };
    let file,imageUrl,preparing;
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
      imageUrl = URL.createObjectURL(blob);

    }

    section.querySelector('.dd-save').onclick=async(event)=>{
      const button=event.currentTarget;button.disabled=true;status.textContent='Preparing image…';
      try{
        if(!preparing)preparing=prepare();
        await preparing;
        const download=document.createElement('a');download.href=imageUrl;download.download=file.name;
        document.body.append(download);download.click();download.remove();
        status.textContent='Image saved. For Stories, use Copy link and add a Link sticker.';
      }catch{preparing=null;status.textContent='Could not save the image. Please try again.';}
      finally{button.disabled=false;}
    };
    window.addEventListener('pagehide',event=>{if(!event.persisted&&imageUrl)URL.revokeObjectURL(imageUrl);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
