import { boot, sleep } from './play-lib.mjs';
const T = await boot('Arayuz Test'); const { I } = T; const issues = []; const log = (...a) => console.log(...a);
const check = async (label) => { const txt = await I(() => (document.querySelector('.sheet')?.innerText ?? '') + ' ' + [...document.querySelectorAll('.modal')].map((m) => m.innerText).join(' ')); const m = txt.match(/\[object [A-Za-z]+\]|undefined|NaN|null\b/g); if (m) issues.push(`${label}: ${[...new Set(m)].join(',')} :: ${txt.slice(txt.search(/\[object|undefined|NaN|null\b/) - 60, txt.search(/\[object|undefined|NaN|null\b/) + 30).replace(/\s+/g, ' ')}`); return txt.length; };
const me = await T.me(); log('me', me.name, me.prof, 'kayzer?', await I(() => window.__imp().world.kayzerId) === me.id);
for (const s of ['yap', 'hedef', 'cemiyet', 'soylu', 'ben', 'mesaj', 'divan', 'aile', 'gazete', 'ayar', 'saray', 'meclis', 'tarih', 'olay', 'kural']) { await I((s) => window.__imp().menu(s), s); await sleep(450); const n = await check('menu ' + s); log('menu', s, n); }
const bids = await I(() => window.__imp().world.buildings.map((b) => b.id));
const closeS = () => I(() => document.querySelector('.sheet .close')?.click());
for (const id of bids) { await I((id) => window.__imp().openB(id), id); await sleep(150); await check('building ' + id); }
log('buildings', bids.length);
await I(() => window.__imp().admin()); await sleep(600); log('admin', await check('admin'));
// citizens register at Saray (need to be there): teleport by walking state
await T.W("const p=w.people.find(q=>q.id===arg.id); const s=w.buildings.find(b=>b.id==='saray'); p.walk={path:[{x:s.door.x+0.5,y:s.door.y+0.6},{x:s.door.x+0.51,y:s.door.y+0.6}],t0:Date.now()-60000,speed:3.6};", { id: me.id }); await sleep(3500);
await I(() => window.__imp().menu('saray')); await sleep(500); log('saray sheet', (await T.sheet()).replace(/\s+/g,' ').slice(0,300)); await T.click('defter'); await T.click('Vatandaş'); await sleep(800); log('citizens', await check('citizens'), (await T.sheet()).slice(0, 80).replace(/\s+/g, ' '));
await closeS(); await sleep(400);
// tap election sign
const sc = await I(() => window.__imp().toScreen(28.6 + 0.9, 21.2 - 0.5)); await I(() => window.__imp().look(28.6, 21.2)); await sleep(500); const sc2 = await I(() => window.__imp().toScreen(29.4, 20.8)); await closeS(); await sleep(300); await T.p.touchscreen.tap(sc2[0], sc2[1]); await sleep(800); log('sign', (await T.sheet()).slice(0, 60).replace(/\s+/g, ' ')); await check('sign');
// tap a person nearby -> person sheet
const near = await I((id) => { const S = window.__imp(); const m = S.placed.find((q) => q[0] === id); const o = S.placed.filter((q) => q[3] && q[0] !== id).sort((a, b) => Math.hypot(a[1] - m[1], a[2] - m[2]) - Math.hypot(b[1] - m[1], b[2] - m[2]))[0]; return o; }, me.id);
await closeS(); await I((q) => window.__imp().look(q[1], q[2]), near); await sleep(400); await T.tapWorld(near[1], near[2] - 0.5); await sleep(8000); log('person sheet', (await T.sheet()).slice(0, 60).replace(/\s+/g, ' ')); await check('person');
// night music mood switch
await T.W("w.hour=22;"); await sleep(4000); log('mood at 22h', await I(() => window.__imp().mood()));
await T.W("w.hour=8;"); await sleep(4000); log('mood at 8h', await I(() => window.__imp().mood()));
// hunger alert
await T.W("const p=w.people.find(q=>q.id===arg); p.hunger=90; p.thirst=50;", me.id); await sleep(4000);
log('hud', (await I(() => document.querySelector('.hud')?.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 160)); log('alerts', (await I(() => [...document.querySelectorAll('.modal, .toast, .alert-pop')].map((x) => x.innerText).join(' | '))).slice(0, 200));
log('ISSUES', issues.length ? issues.join('\n') : 'none'); log('errors', T.errors.slice(0, 10)); await T.b.close();
