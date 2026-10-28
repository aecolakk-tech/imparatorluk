import { boot, sleep } from './play-lib.mjs'; import { writeFileSync, readFileSync } from 'node:fs';
const T = await boot('Film Test', '&poll6'); const { p, I } = T;
const hv = await I(() => window.__imp().world.buildings.find((b) => b.id === 'hayvan'));
await I((h) => window.__imp().look(h.x + 4, h.y + 2), hv); await sleep(1500); await p.screenshot({ path: 'perf/pen.png' });
const tgt = await I(() => { const S = window.__imp(); return S.placed.filter((q) => q[3]).map((q) => q); });
// pick a spot with walkers: the busiest 10x6 window
await I(() => { const S = window.__imp(); const pts = S.placed.filter((q) => q[3]); let best = [40, 24], bn = 0; for (let x = 4; x < 95; x += 3) for (let y = 4; y < 46; y += 3) { const n = pts.filter((q) => Math.abs(q[1] - x) < 6 && Math.abs(q[2] - y) < 3).length; if (n > bn) { bn = n; best = [x, y]; } } S.look(best[0], best[1]); });
await sleep(1200); const files = [];
for (let i = 0; i < 10; i++) { const f = `perf/film-${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f }); files.push(f); await sleep(150); }
// composite into one strip (5x2) inside the page
const data = files.map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
const out = await I(async (data) => { const imgs = await Promise.all(data.map((d) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = d; }))); const w = imgs[0].width / 2, h = imgs[0].height / 2; const c = document.createElement('canvas'); c.width = w * 5; c.height = h * 2; const g = c.getContext('2d'); imgs.forEach((im, i) => { g.drawImage(im, (i % 5) * w, Math.floor(i / 5) * h, w, h); g.fillStyle = '#000'; g.fillText(`t=${i * 150}ms`, (i % 5) * w + 6, Math.floor(i / 5) * h + 14); }); return c.toDataURL('image/png'); }, data);
writeFileSync('perf/filmstrip.png', Buffer.from(out.split(',')[1], 'base64')); await T.b.close(); console.log('ok', T.errors);
