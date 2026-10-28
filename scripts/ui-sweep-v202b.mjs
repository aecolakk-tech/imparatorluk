// v2.0.2 UI sweep 2: kese history, Mesaj input, Pazar 'Tükendi' + sipariş, Panayır visuals, Kayzer tools, Yer bul trail, creation form, funeral.
import { boot, sleep } from './play-lib.mjs';
const OUT = '/workspace/raid/v202'; const T = await boot('Esnaf Test'); const { I, p } = T; const log = (...a) => console.log(...a);
const me0 = await T.me(); const clear = () => I(() => { document.querySelectorAll('.modal:not(.funeral-modal), .a2hs').forEach((x) => x.remove()); }); const vis = (sel) => I((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom <= innerHeight && r.right <= innerWidth && r.top >= 0 }; }, sel);
await T.W(`const me = w.people.find((q) => q.id === arg); me.lookSet = true; me.genderSet = true; me.profile = { ...(me.profile ?? {}), set: true }; me.onboardUntil = 0; me.money = 300;
  w.kayzerId = me.id; me.prof = 'kayzer'; me.soylu = true; w.day = 45; w.hour = 10; w.panayir = 45; w.shelfOut = true;
  for (const l of w.listings) if (l.good === 'odun' || l.good === 'alet') l.qty = 0; w.orders = [{ id: 'O1', byId: 'saray', good: 'kumas', qty: 3, reward: 9, until: 47 }];
  for (const k of Object.keys(w.whatsNew ?? {})) w.whatsNew[k] = 'v9';`, me0.id);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500); await T.dismiss();
// A10: kese history + Mesaj input in landscape
await I(() => window.__imp().purse()); await sleep(500); log('kese', (await T.sheet()).replace(/\s+/g, ' ').slice(0, 140));
await I(() => window.__imp().menu('mesaj')); await sleep(500); log('mesaj input', JSON.stringify(await vis('.sheet input, .sheet textarea')));
await I(() => window.__imp().menu('yap')); await sleep(500); log('Su iç rows', JSON.stringify(await I(() => [...document.querySelectorAll('.sheet button')].filter((b) => /Su iç|İç/.test(b.textContent)).slice(0, 2).map((b) => ({ t: b.textContent.trim().slice(0, 40), h: b.offsetHeight, sw: b.scrollWidth, cw: b.clientWidth })))));
// E1/E8: Pazar + Liman sheets
await I(() => window.__imp().openB('pazar')); await sleep(600); const pz = await T.sheet(); log('pazar tükendi', /Tükendi/.test(pz), 'sipariş', /Sipariş/.test(pz), 'panayır', /PANAYIR/.test(pz), pz.replace(/\s+/g, ' ').slice(0, 200)); await p.screenshot({ path: `${OUT}/pazar.png` });
await I(() => window.__imp().openB('liman')); await sleep(600); const lm = await T.sheet(); log('liman toptan', /toptan|Toptan/.test(lm), lm.replace(/\s+/g, ' ').slice(0, 160));
await I(() => document.querySelector('.sheet .close')?.click()); await sleep(300);
// E7: Panayır visuals at the Pazar
await clear();
await I(() => { const w = window.__imp().world; const b = w.buildings.find((x) => x.id === 'pazar'); window.__imp().look(b.x + b.w / 2, b.y + b.h / 2); }); await sleep(1200); await clear(); await sleep(150); await p.screenshot({ path: `${OUT}/panayir.png` });
log('hud chips', (await I(() => document.querySelector('.hud')?.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 200));
// E9: Kayzer tools (Saray menu)
await I(() => window.__imp().openB('saray')); await sleep(600); await I(() => document.querySelectorAll('.sheet details').forEach((d) => (d.open = true))); await sleep(200); const sr = await T.sheet(); log('saray text', sr.replace(/\s+/g, ' ').slice(0, 300)); log('saray tools', ['Vergi', 'Ambar', 'Narh', 'thalat'].map((k) => `${k}:${sr.includes(k)}`).join(' '));
await I(() => document.querySelector('.sheet .close')?.click()); await sleep(300);
// F4: Yer bul → trail + Gir label
await clear(); await I(() => window.__imp().places()); await sleep(500); log('place click', await T.click('Pazar', '.place-list button')); await sleep(2500); await clear();
await I(() => { const w = window.__imp().world; const s = window.__imp(); const m = s.placed.find((q) => q[0] === w.people.find((x) => x.name === s.me || x.name.endsWith(s.me))?.id); if (m) s.look(m[1], m[2]); }); await sleep(600); await clear(); log('act label', await I(() => document.querySelector('.act-btn:not(.atk)')?.innerText)); await p.screenshot({ path: `${OUT}/yerbul-trail.png` });
log('errors', JSON.stringify(T.errors.slice(0, 6)));
// D9: funeral screen
await T.W(`const pl = Object.values(w.players).find((x) => x.personId === arg && /Test$/.test(x.name ?? '')); const me = w.people.find((q) => q.id === arg); pl.dead = { day: w.day, name: me.name, years: 30, text: 'yaşlılıktan öldü', heirs: [] }; w.people = w.people.filter((q) => q.id !== arg);`, me0.id); await sleep(4000);
log('dead state', JSON.stringify(await I((id) => { const w = window.__imp().world; const pl = Object.values(w.players).find((x) => x.personId === id); return { dead: pl?.dead, person: !!w.people.find((q) => q.id === id), modals: [...document.querySelectorAll('.modal')].map((m) => m.className + ':' + m.innerText.slice(0, 80)) }; }, me0.id)));
log('funeral', (await I(() => document.querySelector('.funeral-modal')?.innerText ?? 'yok')).replace(/\s+/g, ' ').slice(0, 200)); await p.screenshot({ path: `${OUT}/funeral.png` });
await T.b.close();
// C5: creation form for a brand-new player
const T2 = await boot('Yeni Oyuncu', '&nocreate=0'); await sleep(1500);
log('creation', (await T2.I(() => [...document.querySelectorAll('.modal')].map((m) => m.innerText).join(' | '))).replace(/\s+/g, ' ').slice(0, 300)); await T2.p.screenshot({ path: `${OUT}/creation.png` });
log('errors2', JSON.stringify(T2.errors.slice(0, 6))); await T2.b.close();
