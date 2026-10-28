// v2.0.5: an action's answer carries the new world: money/inventory update without waiting for the next heartbeat.
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Alim Test', '&poll6'); await T.dismiss();
await T.W(`const pl = Object.values(w.players).find((x) => x.name.includes('Alim')); const p = w.people.find((q) => q.id === pl.personId); p.money = 50; const b = w.buildings.find((x) => x.id === 'pazar'); p.walk = { path: [{ x: b.door.x, y: b.door.y }], t0: 0, speed: 1 };`);
await sleep(7000);
const s0 = await T.I(() => { const m = window.__imp().world.people.find((q) => q.name.includes('Alim')); return { money: m.money, ekmek: m.inv.ekmek, hb: (window.__hb ?? []).length }; });
const t0 = Date.now();
await T.I(() => window.__imp().act({ t: 'buy', good: 'ekmek', qty: 1 }));
let s1; for (let i = 0; i < 40; i++) { s1 = await T.I(() => { const m = window.__imp().world.people.find((q) => q.name.includes('Alim')); return { money: m.money, ekmek: m.inv.ekmek, hb: (window.__hb ?? []).length }; }); if (s1.ekmek !== s0.ekmek || s1.money !== s0.money) break; await sleep(50); }
console.log('before', s0, 'after', s1, 'ms', Date.now() - t0, 'toasts', await T.toasts());
console.log('updated without a heartbeat:', s1.hb === s0.hb && (s1.ekmek !== s0.ekmek || s1.money !== s0.money));
console.log('errors', T.errors); await T.b.close();
