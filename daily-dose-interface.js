/* Shared, accessible interface behaviour. No data submission or publishing code. */
(() => {
  const todayLink=document.getElementById('todayDoseLink');
  if(todayLink){
    const labelToday=()=>{todayLink.textContent=/\/devotions\//.test(todayLink.href)?'Read today’s devotion':'Browse devotions';};
    labelToday();new MutationObserver(labelToday).observe(todayLink,{attributes:true,attributeFilter:['href']});
  }
  // Presentation only: keep the original verse nodes and all share listeners.
  const verseSection=document.getElementById('verse-of-the-day');
  function styleVerse(){
    const card=verseSection?.querySelector('.verse-feature-card');
    if(!card||card.querySelector('.dd-scripture-card'))return;
    const panel=document.createElement('div');panel.className='dd-scripture-card';
    card.prepend(panel);
    for(const selector of ['#votdHeading','#votdDate','#votdText','#votdReference']){
      const node=card.querySelector(selector);if(node)panel.append(node);
    }
    const reflection=card.querySelector('.verse-actions a');
    if(reflection)reflection.textContent='Read today’s devotion';
  }
  if(verseSection){styleVerse();new MutationObserver(styleVerse).observe(verseSection,{childList:true,subtree:true});}
  // Keep the existing archive sharing controls, below browsing instead of above search.
  function placePageSharing(){
   const archive=document.querySelector('#archiveGrid,.series-library-grid,.series-grid');
   if(archive){
    const sharing=document.querySelector('main .share-box');
    if(sharing){
      const details=document.createElement('details');details.className='dd-page-sharing';
      const summary=document.createElement('summary');summary.textContent='Share this page';
      details.append(summary,sharing);archive.parentElement.append(details);
    }
   }
  }
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',placePageSharing,{once:true});else placePageSharing();
  const menu=document.getElementById('mobileMenu'),open=document.getElementById('menuBtn'),close=document.getElementById('closeBtn');
  if(menu&&open&&close){
    let shown=false;
    menu.removeAttribute('aria-modal');menu.setAttribute('role','region');
    const setOpen=(value,restore=true)=>{
      shown=value;menu.hidden=!value;menu.classList.toggle('open',value);open.setAttribute('aria-expanded',String(value));document.body.classList.toggle('menu-open',value);
      open.setAttribute('aria-label',value?'Close menu':'Open menu');
      if(!value&&restore)open.focus();
    };
    open.addEventListener('click',e=>{e.stopImmediatePropagation();setOpen(!shown);},true);
    close.addEventListener('click',e=>{e.stopImmediatePropagation();setOpen(false);},true);
    menu.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false,false);});
    document.addEventListener('keydown',e=>{
      if(!shown)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setOpen(false);}
    },true);
    document.addEventListener('click',e=>{if(shown&&!menu.contains(e.target)&&!open.contains(e.target))setOpen(false,false);});
    document.addEventListener('focusin',e=>{if(shown&&!menu.contains(e.target)&&!open.contains(e.target))setOpen(false,false);});
    matchMedia('(min-width: 1081px)').addEventListener('change',e=>{if(e.matches&&shown)setOpen(false,false);});
  }
  function placePrivacyControl(){
    const placeholder=document.querySelector('.dd-footer .dd-privacy-link');
    const control=document.getElementById('analyticsPrivacyChoices');
    if(placeholder&&control){control.classList.add('dd-privacy-link');placeholder.replaceWith(control);}
    else placeholder?.addEventListener('click',()=>{location.href='/privacy.html#analytics';});
  }
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',placePrivacyControl,{once:true});else placePrivacyControl();
})();
