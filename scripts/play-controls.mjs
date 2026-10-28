// v2.0.1: map taps never walk; building tap selects, Etkileşim opens it in reach; person tap shows label; Yer bul walks. Phone + desktop.
import { boot, sleep } from './play-lib.mjs';
const OUT = '/workspace/raid/v201';
const T = await boot('Kontrol Test'); const { p, I } = T; const log = (...a) => console.log(...a);
const pos = () => I(() => { const s = window.__imp(); const pid = Object.values(s.world.players).find((x) => x.name === s.me)?.personId; const q = s.placed.find((x) => x[0] === pid); return q ? [+q[1].toFixed(2), +q[2].toFixed(2)] : null; });
await T.W(`const me = w.people.find((q) => q.id === Object.values(w.players).find((x) => x.founder)?.personId); me.walk = { path: [{ x: 36, y: 29.4 }], t0: Date.now(), speed: 3.6 }; me.homeUntil = 0; w.combat = null; w.raid = null; w.foreign = null; for (const k of Object.keys(w.whatsNew ?? {})) w.whatsNew[k] = 'v2.0.1';`);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500); await T.dismiss();
const p0 = await pos();
// 1) empty-ground tap: no walk
await T.tapWorld(Math.max(1, p0[0] - 6), p0[1] + 0.3); await sleep(2500); const p1 = await pos();
log('empty tap → moved?', JSON.stringify(p0), JSON.stringify(p1), Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.2 ? 'NO (ok)' : 'YES (bug)');
// 2) building tap (Pazar roof) → selected, no walk, no panel
await T.tapWorld(38, 26.8); await sleep(1500); const p2 = await pos();
log('pazar tap: selected', JSON.stringify(await I(() => window.__imp().sel())), 'sheet open?', !!(await T.sheet()), 'moved?', Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) >= 0.2, 'toast:', await T.toasts());
// 3) Etkileşim at the Pazar door (we stand at 36,29.4 → in reach of the door at y 28)
const ib = await I(() => { const r = document.querySelector('.act-btn.itr').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, document.querySelector('.act-btn.itr').innerText]; });
log('Etkileşim label:', ib[2]); await p.touchscreen.tap(ib[0], ib[1]); await sleep(1200);
log('after Etkileşim, sheet:', (await T.sheet()).slice(0, 80).replace(/\n/g, ' | '));
await p.screenshot({ path: `${OUT}/controls-etkilesim-pazar.png` });
await T.I(() => document.querySelector('.sheet .close')?.click()); await sleep(500);
// 4) sign tap (Meclis seçim tabelası) still works at its own spot, Pazar label tap does not open it
await T.tapWorld(36, 21.6); await sleep(800); log('tap above Pazar label → sign opened?', (await T.sheet()).includes('Seçim Tabelası') || (await I(() => !!document.querySelector('.modal')?.innerText.includes('Seçim'))));
await T.I(() => { document.querySelector('.sheet .close')?.click(); document.querySelector('.modal button')?.click(); }); await sleep(400);
// 5) person tap → label, no walk
const near = await I(() => { const s = window.__imp(); const pid = Object.values(s.world.players).find((x) => x.name === s.me)?.personId; const me = s.placed.find((x) => x[0] === pid); return s.placed.filter((x) => x[3] && x[0] !== pid).sort((a, b) => Math.hypot(a[1] - me[1], a[2] - me[2]) - Math.hypot(b[1] - me[1], b[2] - me[2]))[0]; });
const pa = await pos(); await T.tapWorld(near[1], near[2] - 0.7); await sleep(700); const pb = await pos();
log('person tap → label:', await I(() => document.querySelector('.person-label')?.innerText ?? '(none)'), 'moved?', Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) >= 0.2);
// 6) Yer bul → Fırın → Git walks there and opens it
await T.click('Yer bul'); await sleep(600); const okGo = await I(() => { const b = [...document.querySelectorAll('.sheet button')].find((x) => /Fırın/.test(x.textContent)); b?.click(); return !!b; });
log('Yer bul → Fırın clicked', okGo); const y0 = await pos(); for (let i = 0; i < 40; i++) { const t = await T.sheet(); if (t && !t.includes('Yer bul')) break; await sleep(500); } log('walked from', JSON.stringify(y0), 'to', JSON.stringify(await pos()));
log('arrived, panel:', (await T.sheet()).slice(0, 60).replace(/\n/g, ' | '));
// 7) desktop: WASD
await T.I(() => document.querySelector('.sheet .close')?.click());
await p.setViewport({ width: 1366, height: 800, deviceScaleFactor: 1 }); await sleep(1200);
const d0 = await pos(); await p.keyboard.down('s'); await sleep(1200); await p.keyboard.up('s'); await sleep(500); const d1 = await pos(); log('desktop S key', JSON.stringify(d0), '→', JSON.stringify(d1));
await p.screenshot({ path: `${OUT}/controls-desktop.png` });
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
