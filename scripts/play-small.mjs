// Login/register + creator on small landscape phones: everything reachable by scrolling.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sizes = [[640, 360], [732, 412], [780, 360], [844, 390], [915, 412], [568, 320]];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
for (const [W, H] of sizes) {
  const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:5173/?live', { waitUntil: 'networkidle0' });
  await p.evaluate(async () => { localStorage.clear(); const st = await (await fetch('__live.json')).json(); localStorage.setItem('imparatorluk-mock-v1', JSON.stringify(st)); });
  await p.reload({ waitUntil: 'networkidle0' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt'))?.click()); await sleep(400);
  // simulate the keyboard: shrink the viewport by ~45%
  await p.setViewport({ width: W, height: Math.round(H * 0.55), deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(300);
  const r = await p.evaluate(() => { const L = document.querySelector('.login'); const bt = [...document.querySelectorAll('.login button')].find((x) => x.textContent.includes('Hesap aç')); L.scrollTop = L.scrollHeight; const br = bt.getBoundingClientRect(); const top = document.querySelector('.login input').getBoundingClientRect(); L.scrollTop = 0; const t2 = document.querySelector('.login input').getBoundingClientRect(); return { scrollable: L.scrollHeight > L.clientHeight, btnVisibleAfterScroll: br.bottom <= innerHeight && br.top >= 0, firstInputVisibleAtTop: t2.top >= 0 }; });
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(300);
  const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type('Kucuk Ekran'); await ins[2].type(`k${W}@x.com`); await ins[3].type('gizli123');
  await p.evaluate(() => { const bt = [...document.querySelectorAll('.login button')].find((x) => x.textContent.includes('Hesap aç')); bt.scrollIntoView(); bt.click(); }); await sleep(3500);
  await p.evaluate(() => { document.querySelectorAll('.modal:not(.look-modal)').forEach((x) => x.remove()); window.__openLook?.('ilk'); }); await sleep(500);
  const c = await p.evaluate(() => { const m = document.querySelector('.look-modal .box'); if (!m) return { creator: false }; const sv = [...m.querySelectorAll('button')].find((x) => x.textContent.includes('Kaydet')); sv.scrollIntoView(); const r = sv.getBoundingClientRect(); return { creator: true, saveReachable: r.bottom <= innerHeight + 1 && r.top >= 0, boxFits: m.getBoundingClientRect().height <= innerHeight }; });
  await p.screenshot({ path: `perf/small-${W}x${H}.png` });
  console.log(`${W}x${H}`, JSON.stringify(r), JSON.stringify(c));
  await p.close();
}
await b.close();
