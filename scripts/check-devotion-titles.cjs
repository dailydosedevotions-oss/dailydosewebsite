const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const entities = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',mdash:'—',ndash:'–',nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
const text = value => value.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, key) => key[0] === '#' ? String.fromCodePoint(key[1] === 'x' ? parseInt(key.slice(2),16) : parseInt(key.slice(1),10)) : entities[key] ?? all).replace(/\s+/g,' ').trim();
const title = value => text(value).replace(/^Daily Dose\s*#\d+\s*[:—–-]\s*/i,'').replace(/^FORMED\s+(?=Part\s+\d)/i,'').replace(/\s*\|\s*Daily Dose Devotions$/i,'');
const errors = [];
let pageCount = 0, cardCount = 0, emailCount = 0;
const pages = new Map();
for (const folder of ['devotions','series']) {
  for (const name of fs.readdirSync(path.join(root, folder))) {
    if (!(folder === 'devotions' ? /^daily-dose-.*\.html$/ : /-part-\d+\.html$/).test(name)) continue;
    const file = `${folder}/${name}`, html = read(file);
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>title(m[1]));
    if (headings.length !== 1) errors.push(`${file}: expected one main heading, found ${headings.length}`);
    const heading = headings[0]; pages.set(file, heading); pageCount++;
    const pageTitle = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const shareTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1];
    for (const [label, value] of [['browser title',pageTitle],['share title',shareTitle]]) {
      if (value && title(value) !== heading) errors.push(`${file}: ${label} "${title(value)}" != "${heading}"`);
    }
  }
}
for (const file of ['devotions.html','series/formed.html','series/blessed-are.html']) {
  for (const match of read(file).matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)) {
    const card = match[0], link = card.match(/href="\/?((?:devotions|series)\/[^"?#]+\.html)/)?.[1];
    if (!link || !pages.has(link)) continue;
    cardCount++;
    const heading = title(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
    if (heading !== pages.get(link)) errors.push(`${file} -> ${link}: card "${heading}" != "${pages.get(link)}"`);
  }
}
for (const name of fs.readdirSync(path.join(root,'devotions')).filter(n=>n.endsWith('.json'))) {
  const data = JSON.parse(read(`devotions/${name}`));
  // The earliest email record predates explicit URLs; its issue number links it to the page.
  const number = data.title.match(/^Daily Dose\s*#(\d+)/i)?.[1];
  const file = data.url ? new URL(data.url).pathname.slice(1) : number ? `devotions/daily-dose-${number}.html` : null;
  if (!pages.has(file)) { errors.push(`devotions/${name}: missing linked devotion page`); continue; }
  emailCount++;
  if (title(data.title) !== pages.get(file)) errors.push(`devotions/${name}: email "${title(data.title)}" != "${pages.get(file)}"`);
}
console.log(`Checked ${pageCount} devotion pages, ${cardCount} archive/series cards and ${emailCount} email records.`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('All titles match; every devotion has exactly one main heading.');
