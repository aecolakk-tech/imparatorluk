import puppeteer from 'puppeteer-core';
const url = process.env.URL ?? 'http://localhost:5173/'; const OUT = '/workspace/imparatorluk/shots19';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const I = (f, ...a) => p.evaluate(f, ...a);
await p.goto(url, { waitUntil: 'networkidle0' });
if (!process.env.URL) { await I(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt')).click()); await sleep(300);
  const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type('Hayvan Test'); await ins[2].type('h@x.com'); await ins[3].type('gizli123');
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Hesap aç')).click()); await sleep(2500); }
else await sleep(6000);
for (let i = 0; i < 12; i++) { await I(() => [...document.querySelectorAll('.modal button, .a2hs button')].find((x) => /Tamam|Kapat|Atla|Geç|✕/.test(x.textContent) || x.querySelector('svg'))?.click()); await sleep(250); }
const info = await I(() => { const w = window.__imp().world; const hv = w.buildings.find((x) => x.id === 'hayvan'); const cf = w.buildings.find((x) => x.id === 'ciftlik');
  return { schema: w.schema, hv: hv && [hv.x, hv.y, hv.w, hv.h], cf: cf && [cf.x, cf.y, cf.w, cf.h], owners: w.people.filter((q) => q.animals && Object.values(q.animals).some((n) => n > 0)).map((q) => q.prof + ':' + JSON.stringify(q.animals)) }; });
console.log(JSON.stringify(info));
await I((h) => window.__imp().look(h[0] + h[2] / 2, h[1] + h[3] / 2), info.hv); await sleep(1500); await p.screenshot({ path: `${OUT}/a1-pen${process.env.URL ? '-live' : ''}.png` });
await I((h) => window.__imp().look(h[0] + h[2] / 2, h[1] + h[3] / 2), info.cf); await sleep(1500); await p.screenshot({ path: `${OUT}/a2-fields${process.env.URL ? '-live' : ''}.png` });
await b.close();
