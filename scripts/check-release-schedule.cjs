const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('functions/_middleware.js').replace('export async function onRequest','async function onRequest');
const archive=read('devotions.html');
const cards=[...archive.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);
const rows=fs.readdirSync(path.join(root,'devotions')).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)&&n>='2026-07-26').sort();
let previous='',checked=0;
async function request(url,html,now){
 class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} }
 class Rewriter { on(){return this;} transform(r){return r;} }
 const context={Date:Clock,URL,Intl,Response,HTMLRewriter:Rewriter};vm.createContext(context);vm.runInContext(source,context);
 return context.onRequest({request:new Request('https://dailydosedevotions.ie'+url),next:async()=>new Response(html,{headers:{'content-type':'text/html'}})});
}
(async()=>{
 for(const name of rows){
  const date=name.slice(0,10),data=JSON.parse(read('devotions/'+name)),p=new URL(data.url).pathname,html=read(p.slice(1));
  const at=html.match(/<body\b[^>]*data-publish-at="([^"]+)"/)?.[1];assert(at,`${name}: missing timestamp`);
  assert.equal(at.slice(0,10),date);assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit'}).format(new Date(at)),'07:00');
  if(previous)assert.equal(Date.parse(date)-Date.parse(previous),86400000);previous=date;
  const matching=cards.filter(c=>c.includes(p.slice(1)));assert.equal(matching.length,1);assert(matching[0].includes(at));assert(data.body.trim().length>200);
  for(const route of [p,p.replace(/\.html$/,''),'/devotions/'+name]){
   const before=await request(route,html,Date.parse(at)-1);assert.equal(before.status,403,route);assert.equal(before.headers.get('cache-control'),'no-store, max-age=0');assert(!(await before.text()).includes(data.body.slice(0,30)));
   const due=await request(route,html,Date.parse(at));assert.equal(due.status,200,route);
  }
  checked++;
 }
 const invalid=await request('/devotions/daily-dose-new','<body data-publish-at="invalid">PRIVATE</body>',Date.now());assert.equal(invalid.status,403);
 console.log(`PASS: ${checked} consecutive daily entries; page/card dates, 7am Dublin, full email bodies, clean/.html/JSON release boundaries and no-cache protection.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
