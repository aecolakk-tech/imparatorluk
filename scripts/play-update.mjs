// run first: node scripts/serve-https.mjs (serves /tmp/site/imparatorluk over https://localhost:8443 with a self-signed cert)
// v2.1.0 update/offline flow over https (self-signed, local): SW caches the build → offline start works with the save;
// a newer version.json → the menu reloads once (no loop) and shows "Güncellendi"; saves survive.
import puppeteer from 'puppeteer-core'; import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = 'https://localhost:8443/imparatorluk/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const p = await b.newPage(); await p.setViewport({ width: 844, height: 390 });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
await p.evaluateOnNewDocument(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.innerText); }).observe(document, { childList: true, subtree: true }); });
const I = (f, ...a) => p.evaluate(f, ...a); const click = (t) => I((t) => { const x = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); x?.click(); return !!x; }, t);
await p.goto(U, { waitUntil: 'networkidle0' });
await I(() => { localStorage.setItem('imp-guide-done', '1'); localStorage.setItem('imp-music', '0'); });
await click('Yeni Oyun'); await sleep(300); await (await p.$('.solo-menu input')).type('Guncel Testoğlu'); await click('Başla'); await sleep(3000);
console.log('sw controller:', await I(async () => { await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller || 'ready (not yet controlling)'; }));
await p.reload({ waitUntil: 'networkidle0' }); await sleep(1500);
console.log('controlled after reload:', await I(() => !!navigator.serviceWorker.controller), 'caches:', await I(async () => (await caches.keys()).join(',')));
// offline start
await p.setOfflineMode(true); await p.reload({ waitUntil: 'domcontentloaded' }).catch((e) => console.log('reload err', e.message)); await sleep(2500);
console.log('OFFLINE menu:', await I(() => document.querySelector('.solo-menu')?.innerText.replace(/\s+/g, ' ').slice(0, 160) ?? document.body.innerText.slice(0, 120)));
await click('Devam Et'); await sleep(2500); console.log('OFFLINE game running:', await I(() => !!document.querySelector('canvas') && !document.querySelector('.solo-menu')));
await p.setOfflineMode(false);
// a newer version gets published
writeFileSync('/tmp/site/imparatorluk/version.json', JSON.stringify({ version: 'v2.1.1' }));
await I(() => localStorage.setItem('imp-ver', 'v2.0.5')); // as if the previous run was an older build
navs = 0; await p.goto(U, { waitUntil: 'networkidle0' }); await sleep(5000);
console.log('navigations after newer version.json (1 = no reload, 2 = one reload, more = loop):', navs);
console.log('update toast seen:', await I(() => window.__toasts.join('|')));
console.log('save survived:', await I(() => document.querySelector('.solo-menu')?.innerText.includes('Guncel Testoğlu')));
writeFileSync('/tmp/site/imparatorluk/version.json', JSON.stringify({ version: 'v2.1.0' }));
// the updated build is now the one served: first start after the update shows the notice once
await I(() => localStorage.setItem('imp-ver', 'v2.0.5')); await p.goto(U, { waitUntil: 'networkidle0' }); await sleep(1500);
console.log('toast after update:', await I(() => window.__toasts.join('|')), '| menu still there:', await I(() => !!document.querySelector('.solo-menu')));
console.log('errors', JSON.stringify(errors));
await b.close();
