// v2.0.2 combat UI check: waves, held weapon + swing, bow aim, hit feedback, no page errors.
import { boot, sleep } from './play-lib.mjs';
const OUT = '/workspace/raid/v202';
const T = await boot('Kumandan Test'); const { p, I } = T; const log = (...a) => console.log(...a);
await T.W(`const me = w.people.find((q) => q.id === Object.values(w.players).find((x) => x.name === 'Kumandan Test')?.personId) ?? w.people.find((q) => q.playerId && !q.npc);
  me.arms = { kilic: 1, kalkan: 1, yay: 1, ok: 20 }; me.drawn = 'kilic'; me.health = 100; me.wounded = false; me.lookSet = true; me.genderSet = true; me.profile = { ...(me.profile ?? {}), set: true }; me.onboardUntil = 0; me.walk = { path: [{ x: 37, y: 45.6 }], t0: Date.now(), speed: 3.6 };
  w.hour = 9; w.lastTickAt = Date.now() - 2000; w.speed = 1; w.raid = null; w.combat = null; w.speedBefore = null;
  w.foreign = { name: 'Macar Krallığı', demand: 3000, troops: 18, phase: 'savas', day: w.day, deadline: w.day, landReal: Date.now() + 3000, recruits: [] };
  for (const k of Object.keys(w.whatsNew ?? {})) w.whatsNew[k] = 'v9'; return me.name;`);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500); await T.dismiss();
const S = () => I(() => { const w = window.__imp().world; const now = Date.now(); return w.combat ? { spawned: w.combat.spawned, ashore: w.combat.foes.filter((f) => f.hp > 0 && now >= f.walk.t0).length, aboard: w.combat.foes.filter((f) => f.hp > 0 && now < f.walk.t0).length, hits: w.combat.hits.length } : null; });
for (let i = 0; i < 70; i++) { const s = await S(); if (s?.spawned) break; if (i % 8 === 0) await T.dismiss(); await sleep(1000); }
await T.dismiss(); await I(() => window.__imp().look(36, 46)); await sleep(3000);
log('wave1', JSON.stringify(await S())); await p.screenshot({ path: `${OUT}/waves-1.png` });
await sleep(9000); log('wave later', JSON.stringify(await S())); await p.screenshot({ path: `${OUT}/waves-2.png` });
const ab = await I(() => { const r = document.querySelector('.act-btn.atk').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
// free swing with kılıç (maybe nobody in reach): no toast expected
await T.dismiss(); const t0 = await T.toasts(); await p.touchscreen.tap(ab[0], ab[1]); await sleep(150); await p.screenshot({ path: `${OUT}/swing.png` }); await sleep(900);
log('after free swing toasts:', JSON.stringify(await T.toasts()), 'before:', JSON.stringify(t0), 'sfx', await I(() => (window.__sfx ?? []).slice(-3)));
// bow: draw yay, hold Saldır 1.2 s, screenshot aim, release
await T.act({ t: 'drawWeapon', kind: 'yay' }, 1500);
await p.mouse.move(ab[0], ab[1]); await p.mouse.down(); await sleep(1100); await p.screenshot({ path: `${OUT}/bow-aim.png` }); log('aim', JSON.stringify(await I(() => { const a = window.__imp; return document.querySelector('.act-btn.atk')?.title; })));
await p.mouse.up(); await sleep(250); await p.screenshot({ path: `${OUT}/arrow-flight.png` }); await sleep(1500);
log('combat-log', JSON.stringify(await I(() => document.querySelector('.combat-log')?.innerText ?? '')), 'toasts', JSON.stringify(await T.toasts()));
log('my hits', await I(() => { const s = window.__imp(); const w = s.world; const pid = Object.values(w.players).find((x) => x.name === s.me).personId; return JSON.stringify((w.combat?.hits ?? []).filter((h) => h.from === pid).map((h) => [h.k, h.dmg, h.arrow])); }));
// v2.0.3: after the battle, the Menü button must still be on top and open a panel
await T.W("if (w.raid) { w.raid.phase = 'bitti'; } w.combat = undefined;"); await sleep(4000); await T.dismiss();
log('menu-hit after battle', await I(() => { const b = [...document.querySelectorAll('.dock button')].find((x) => /Menü/.test(x.textContent)); const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b.contains(t) ? 'menu-on-top' : 'BLOCKED by ' + (t?.className || t?.tagName); }));
await p.touchscreen.tap(...(await I(() => { const b = [...document.querySelectorAll('.dock button')].find((x) => /Menü/.test(x.textContent)); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }))); await sleep(800);
log('menu opens by real tap after battle', await I(() => !!document.querySelector('.sheet:not(.leave)')));
log('errors', JSON.stringify(T.errors.slice(0, 6)));
await T.b.close();
