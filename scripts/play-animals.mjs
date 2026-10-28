import { boot, sleep } from './play-lib.mjs';
const T = await boot('Hayvan Test'); const log = (...a) => console.log(...a);
let m = await T.me();
const hv = await T.I(() => window.__imp().world.buildings.find((b) => b.id === 'hayvan'));
log('pen', hv.x, hv.y, hv.w, hv.h, 'door', JSON.stringify(hv.door));
log('pen overlaps', await T.I(() => { const w = window.__imp().world; const h = w.buildings.find((b) => b.id === 'hayvan'); return w.buildings.filter((o) => o !== h && h.x < o.x + o.w && h.x + h.w > o.x && h.y < o.y + o.h && h.y + h.h > o.y).map((o) => o.id); }));
await T.I((h) => window.__imp().look(h.x + 4, h.y + 2), hv); await sleep(1200); await T.p.screenshot({ path: 'perf/pen.png' });
// give me a horse + a sheep (no farm -> at home door)
await T.W("const p=w.people.find(q=>q.id===arg); p.animals={inek:0,koyun:1,tavuk:0,at:1}; p.riding=false; p.farm=false;", m.id); await sleep(6500);
// tap someone else's animal in the pen: should NOT open anything animal-related
const other = await T.I(() => { const S = window.__imp(); const w = S.world; const s = w.people.find((p) => p.prof === 'hayvanci'); return s.id; });
await T.I((h) => window.__imp().look(h.x + 4, h.y + 2), hv); await sleep(800);
await T.tapWorld(hv.x + 2, hv.y + 2); log('tap others animal -> sheet:', (await T.sheet()).slice(0, 60).replace(/\s+/g, ' '), 'riding', (await T.me()).riding);
// find my horse
const myA = async () => T.I(async (id) => { const { placeAnimals } = await import('/src/sim/herdpos.ts'); return placeAnimals(window.__imp().world, Date.now()).filter((a) => a.owner === id); }, m.id);
let mine = await myA(); log('my animals', JSON.stringify(mine.map((a) => [a.kind, a.x.toFixed(1), a.y.toFixed(1)])));
const horse = mine.find((a) => a.kind === 'at');
await T.I((h) => window.__imp().look(h.x, h.y), horse); await sleep(800);
await T.I(() => document.querySelector('.sheet .close')?.click()); await sleep(500);
const hz = await T.I(() => window.__imp().world && document.elementFromPoint(...window.__imp().toScreen(0,0))?.tagName); 
mine = await myA(); const h2 = mine.find((a) => a.kind === 'at'); const sc = await T.I((h) => window.__imp().toScreen(h.x, h.y - 0.4), h2); log('horse screen', sc, 'top el', await T.I((s) => document.elementFromPoint(s[0], s[1])?.className || document.elementFromPoint(s[0], s[1])?.tagName, sc));
await T.tapWorld(h2.x, h2.y - 0.4); log('right after tap toasts', await T.toasts(), 'sheet', (await T.sheet()).slice(0, 50)); await sleep(30000);
m = await T.me(); log('after tapping my horse: riding=', m.riding, 'toasts', await T.toasts());
await T.p.screenshot({ path: 'perf/riding.png' });
// tap self to dismount
const pos = await T.I((id) => window.__imp().placed.find((q) => q[0] === id), m.id);
await T.I((q) => window.__imp().look(q[1], q[2]), pos); await sleep(600); await T.tapWorld(pos[1], pos[2] - 0.5); await sleep(2500);
log('after tapping self: riding=', (await T.me()).riding);
// slaughter my sheep
mine = await myA(); const sheep = mine.find((a) => a.kind === 'koyun');
await T.I(() => document.querySelector('.sheet .close')?.click()); await T.I((h) => window.__imp().look(h.x, h.y), sheep); await sleep(600); mine = await myA(); const sh2 = mine.find((a) => a.kind === 'koyun'); sheep.x = sh2.x; sheep.y = sh2.y; await T.tapWorld(sheep.x, sheep.y - 0.3);
log('sheep sheet:', (await T.sheet()).replace(/\s+/g, ' ').slice(0, 120));
await T.click('Kes'); await sleep(25000); m = await T.me(); log('after Kes: koyun', m.animals.koyun, 'et', m.inv.et, 'yun', m.inv.yun, 'toasts', await T.toasts());
// server rule: far away slaughter refused
log('errors', T.errors.slice(0, 5)); await T.b.close();
