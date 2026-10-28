// v2.0.1 UI play-test: Macar landing end-to-end at a phone viewport + controls (joystick, keyboard, hotbar, Saldır, Etkileşim).
import { boot, sleep } from './play-lib.mjs';
const OUT = '/workspace/raid/v201';
const T = await boot('Kumandan Test'); const { p, I } = T;
const log = (...a) => console.log(...a);
// arm the player, put him by the Liman, set a war that lands at 08:00 (game hour 7 now)
await T.W(`const S = Object.values(w.players)[0]; const me = w.people.find((q) => q.id === Object.values(w.players).find((x) => x.founder)?.personId) ?? w.people.find((q) => q.playerId);
  me.arms = { kilic: 1, kalkan: 1, yay: 1, ok: 20 }; me.health = 100; me.wounded = false; me.jailedDays = 0; me.homeUntil = 0; me.walk = { path: [{ x: 40, y: 43.6 }], t0: Date.now(), speed: 3.6 };
  w.hour = 7; w.lastTickAt = Date.now() - 2000; w.speed = 1; w.raid = null; w.combat = null; w.speedBefore = null;
  w.foreign = { name: 'Macar Krallığı', demand: 3000, troops: 18, phase: 'savas', day: w.day, deadline: w.day, landDay: w.day, recruits: [] };
  for (const k of Object.keys(w.whatsNew ?? {})) w.whatsNew[k] = 'v2.0.1'; return me.name;`);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500); await T.dismiss();
const S = () => I(() => { const s = window.__imp(); const w = s.world; return { hour: w.hour, speed: w.speed, landed: !!w.foreign?.landed, combat: w.combat ? { spawned: w.combat.spawned, foes: w.combat.foes.filter((f) => f.hp > 0).length, hits: w.combat.hits.length, assign: Object.keys(w.combat.assign).length } : null, disaster: w.disaster?.text?.slice(0, 90) }; });
log('start', JSON.stringify(await S()));
await I(() => window.__imp().look(26, 41));
// controls exist
log('controls', JSON.stringify(await I(() => ({ slots: document.querySelectorAll('.hotbar .slot').length, joy: !!document.querySelector('.joy'), atk: !!document.querySelector('.act-btn.atk'), itr: !!document.querySelector('.act-btn.itr') }))));
// keyboard walk: hold D for 1 s
const pos = () => I(() => { const s = window.__imp(); const q = s.placed.find((x) => x[0] === s.world.players[Object.keys(s.world.players).find((k) => s.world.players[k].name === s.me)]?.personId); return q ? [+q[1].toFixed(1), +q[2].toFixed(1)] : null; });
const p0 = await pos(); await p.keyboard.down('a'); await sleep(1000); await p.keyboard.up('a'); await sleep(600); const p1 = await pos(); log('keyboard A walk', JSON.stringify(p0), '→', JSON.stringify(p1));
// joystick drag right for 1 s (touch)
const jb = await I(() => { const r = document.querySelector('.joy').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const cdp = await p.target().createCDPSession();
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 7 }] });
await touch('touchStart', jb[0], jb[1]); for (let i = 1; i <= 8; i++) { await touch('touchMove', jb[0] + i * 5, jb[1]); await sleep(30); } await sleep(900); await touch('touchEnd'); await sleep(600);
const p2 = await pos(); log('joystick right walk', JSON.stringify(p1), '→', JSON.stringify(p2));
// hotbar: slot with kılıç → drawn
const slotIdx = await I(() => [...document.querySelectorAll('.hotbar .slot')].findIndex((s) => s.title.startsWith('Kılıç')));
const sb = await I((i) => { const r = document.querySelectorAll('.hotbar .slot')[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, slotIdx);
await p.touchscreen.tap(sb[0], sb[1]); await sleep(2500);
log('hotbar tap kılıç → drawn =', await I(() => { const s = window.__imp(); const w = s.world; const pid = Object.values(w.players).find((x) => x.name === s.me).personId; return w.people.find((q) => q.id === pid).drawn; }), 'slot sel:', await I(() => !!document.querySelector('.hotbar .slot.sel')));
await p.screenshot({ path: `${OUT}/controls-landscape.png` });
// wait for landing + ships sailing
for (let i = 0; i < 90; i++) { const s = await S(); if (s.landed) break; await sleep(1000); }
log('landed', JSON.stringify(await S()));
await sleep(1500); await T.click('Anladım', '.modal button'); await T.dismiss();
log('popup closed', JSON.stringify(await I(() => [...document.querySelectorAll('.modal')].map((m) => m.className))));
await I(() => window.__imp().look(40, 46)); await sleep(9000); await p.screenshot({ path: `${OUT}/ships-sailing.png` });
for (let i = 0; i < 50; i++) { const s = await S(); if (s.combat?.spawned) break; await sleep(1000); }
await T.dismiss(); await I(() => window.__imp().look(36, 45)); await sleep(1500); await p.screenshot({ path: `${OUT}/ships-docked-troops-ashore.png` });
log('ashore', JSON.stringify(await S()));
// fight: walk to nearest foe and press Saldır repeatedly
const ab = await I(() => { const r = document.querySelector('.act-btn.atk').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
let hitsByMe = 0; let shots = 0;
for (let i = 0; i < 70; i++) {
  const st = await S(); if (!st.combat) break;
  if (i % 10 === 0) await T.dismiss();
  await p.touchscreen.tap(ab[0], ab[1]); await sleep(1300);
  if (i === 8 || i === 20) { const pp = await pos(); if (pp) await I((pp) => window.__imp().look(pp[0], pp[1]), pp); await sleep(300); }
  if (i === 8) { await p.screenshot({ path: `${OUT}/fight-1.png` }); }
  if (i === 20) { await p.screenshot({ path: `${OUT}/fight-2.png` }); }
}
const end = await S(); log('after fight', JSON.stringify(end));
hitsByMe = await I(() => (window.__imp().world.combat?.hits ?? []).filter((h) => h.by === window.__imp().me).length);
log('toasts', await T.toasts(), 'combat-log', await I(() => document.querySelector('.combat-log')?.innerText ?? ''));
for (let i = 0; i < 240; i++) { const s = await S(); if (!s.combat) break; await sleep(1000); }
log('final', JSON.stringify(await S()));
await p.screenshot({ path: `${OUT}/after-war.png` });
// Etkileşim: stand next to someone
log('errors', JSON.stringify(T.errors.slice(0, 5)));
await T.b.close();
