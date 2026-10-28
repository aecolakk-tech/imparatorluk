// 3 players in 3 tabs sharing one (mock) world: sync of positions, trade, chat, conflicts.
import puppeteer from 'puppeteer-core'; import { sleep } from './play-lib.mjs';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errs = []; const log = (...a) => console.log(...a);
async function tab(name, first) {
  const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 }); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  const I = (f, ...a) => p.evaluate(f, ...a);
  await p.goto('http://localhost:5173/?live', { waitUntil: 'networkidle0' });
  if (first) { await I(async () => { localStorage.clear(); const st = await (await fetch('__live.json')).json(); localStorage.setItem('imparatorluk-mock-v1', JSON.stringify(st)); localStorage.setItem('imp-guide-done', '1'); localStorage.setItem('imp-music', '0'); }); await p.reload({ waitUntil: 'networkidle0' }); }
  else { await I(() => localStorage.removeItem('imparatorluk-mock-v1-session')); await p.reload({ waitUntil: 'networkidle0' }); }
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Davetle kayıt'))?.click()); await sleep(300);
  const ins = await p.$$('.login input'); await ins[0].type('imparator'); await ins[1].type(name); await ins[2].type(name.replace(/\s/g, '') + '@x.com'); await ins[3].type('gizli123');
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Hesap aç')).click()); await sleep(3000);
  for (let i = 0; i < 10; i++) { await I(() => [...document.querySelectorAll('.modal:not(.trial-modal) button, .a2hs button')].find((x) => /Tamam|Kapat|Atla|Geç|✕/.test(x.textContent))?.click()); await sleep(150); }
  const pid = await I(() => { const S = window.__imp(); return Object.values(S.world.players).find((x) => x.name === S.me)?.personId; });
  return { p, I, name, pid };
}
const A = await tab('Oyuncu Bir', true), B = await tab('Oyuncu Iki', false), C = await tab('Oyuncu Uc', false);
log('ids', A.pid, B.pid, C.pid, '| A still sees self as', await A.I(() => window.__imp().me), '| B', await B.I(() => window.__imp().me));
// A walks; B and C should see A move after their next poll
await A.I(() => window.__imp().act({ t: 'move', x: 40, y: 21 })); await sleep(9000);
const posIn = (T, id) => T.I((id) => window.__imp().placed.find((q) => q[0] === id), id);
log('A seen by A', (await posIn(A, A.pid))?.slice(1, 3).map((v) => v.toFixed(1)), 'by B', (await posIn(B, A.pid))?.slice(1, 3).map((v) => v.toFixed(1)), 'by C', (await posIn(C, A.pid))?.slice(1, 3).map((v) => v.toFixed(1)));
// money transfer A -> B (reach off via give self? give needs proximity): put B next to A
const mB0 = await B.I((id) => window.__imp().world.people.find((p) => p.id === id).money, B.pid);
await B.I(() => window.__imp().act({ t: 'move', x: 40.6, y: 21 })); await sleep(9000);
const r = await A.I((id) => window.__imp().act({ t: 'give', personId: id, amount: 10 }), B.pid); await sleep(9000);
const mB1 = await B.I((id) => window.__imp().world.people.find((p) => p.id === id).money, B.pid); log('B money', mB0, '->', mB1);
// conflict: both A and C rent the last free spot of the same house at once
const hid = await A.I(() => { const w = window.__imp().world; return w.buildings.filter((b) => b.kind === 'ev').map((b) => [b.id, w.people.filter((p) => p.home === b.id).length]).find(([, n]) => n === 4)?.[0]; });
log('house with one free spot', hid);
if (hid) { await Promise.all([A.I((h) => window.__imp().act({ t: 'rentHome', houseId: h }), hid), C.I((h) => window.__imp().act({ t: 'rentHome', houseId: h }), hid)]); await sleep(40000);
  const n = await B.I((h) => window.__imp().world.people.filter((p) => p.home === h).length, hid); log('residents after simultaneous rent', n, '(cap 5)'); }
log('errors', errs); await b.close();
