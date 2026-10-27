// Headless browser smoke test against the dev server in mock mode.
// usage: npm run dev:mock (in another shell) && npm run smoke  [URL env optional]
import puppeteer from 'puppeteer-core';
const url = process.env.URL ?? 'http://localhost:5173/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
async function page(w, hgt) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: hgt, deviceScaleFactor: 1 });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return p;
}
const p = await page(1280, 800);
await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
const click = async (pg, text) => { await pg.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t)); if (!b) throw new Error('no button ' + t); b.click(); }, text); await new Promise((r) => setTimeout(r, 300)); };
await click(p, 'Davetle kayıt');
const inputs = await p.$$('.login input');
await inputs[0].type('imparator'); await inputs[1].type('Ahmet Enes'); await inputs[2].type('kurucu@imparatorluk.local'); await inputs[3].type('gizli123');
await click(p, 'Hesap aç');
await new Promise((r) => setTimeout(r, 1500));
// dismiss guide modals
for (let i = 0; i < 8; i += 1) { const has = await p.$('.modal'); if (!has) break; await click(p, 'Tamam'); }
await p.screenshot({ path: '/workspace/imparatorluk/smoke-map.png' });
const st = await p.evaluate(() => window.__imp());
console.log('me:', st.me, 'people:', st.world.people.length, 'day', st.world.day, 'hour', st.world.hour, 'frozen', st.world.frozen);
// open saray panel via dock and screenshot
await click(p, 'Saray'); await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: '/workspace/imparatorluk/smoke-saray.png' });
await click(p, '✕');
await p.evaluate(() => { const w = window.__imp().world; void w; });
// tap the Pazar building on the canvas (center of the screen-ish) – compute from camera via hitTest is internal; just tap many spots
await p.mouse.click(640, 400); await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: '/workspace/imparatorluk/smoke-tap.png' });
// chat
await click(p, 'Meydan'); await p.type('.sheet input', 'Selam millet amk'); await click(p, 'Gönder');
const chat = await p.evaluate(() => document.querySelector('.msgs')?.textContent);
console.log('chat:', chat);
// second player in a new context: shares localStorage in the same browser profile
const p2 = await page(390, 844);
await p2.goto(url, { waitUntil: 'networkidle0' });
await p2.evaluate(() => localStorage.removeItem('imparatorluk-mock-v1-session')); await p2.reload({ waitUntil: 'networkidle0' });
await click(p2, 'Davetle kayıt');
const typeInto = async (pg, idx, text) => { const ins = await pg.$$('.login input'); await ins[idx].click({ clickCount: 3 }); await ins[idx].type(text); };
await click(p2, 'Var olan birini devral');
await typeInto(p2, 0, 'yanlis'); await click(p2, 'göster');
await typeInto(p2, 0, 'imparator'); await click(p2, 'göster'); await new Promise((r) => setTimeout(r, 300));
const opt = await p2.evaluate(() => { const s = document.querySelector('.login select'); s.value = s.options[1].value; s.dispatchEvent(new Event('change')); return s.options[1].textContent; });
await new Promise((r) => setTimeout(r, 300));
console.log('takeover pick:', opt, '| card shown:', await p2.evaluate(() => !!document.querySelector('.login .card canvas')));
await typeInto(p2, 1, 'berat@x.com'); await typeInto(p2, 2, 'gizli123');
await click(p2, 'Hesap aç'); await new Promise((r) => setTimeout(r, 2500));
for (let i = 0; i < 8; i += 1) { const has = await p2.$('.modal'); if (!has) break; await click(p2, 'Tamam'); }
await p2.screenshot({ path: '/workspace/imparatorluk/smoke-phone.png' });
const st2 = await p2.evaluate(() => window.__imp());
console.log('phone me:', st2.me, 'players:', Object.keys(st2.world.players).length);
// fps check
const fps = await p2.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n += 1; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log('phone fps (headless):', fps);
// open the Meclis building panel through the map hit-test helper (dock has no Meclis button)
const meclisOk = await p.evaluate(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Saray')); btn?.click(); return true; });
await new Promise((r) => setTimeout(r, 300));
console.log('saray sanction section:', await p.evaluate(() => document.querySelector('.sheet')?.textContent?.includes('Meclis kararları')), meclisOk);
await click(p, '✕'); await click(p, 'Meclis'); await new Promise((r) => setTimeout(r, 300));
console.log('meclis panel:', await p.evaluate(() => ['Sandalyeler', 'Partiler', 'Gündem', 'Meclis gazetesi'].map((k) => document.querySelector('.sheet')?.textContent?.includes(k))));
await p.screenshot({ path: '/workspace/imparatorluk/smoke-meclis.png' });
await click(p, '✕'); await click(p, 'Aile'); await new Promise((r) => setTimeout(r, 300));
console.log('aile panel:', await p.evaluate(() => ['Aile', 'Soy ağacı', 'Çocuklar'].map((k) => document.querySelector('.sheet')?.textContent?.includes(k))));
await p.screenshot({ path: '/workspace/imparatorluk/smoke-aile.png' });
console.log('console errors/warnings:', errors.length ? errors : 'none');
await browser.close();
