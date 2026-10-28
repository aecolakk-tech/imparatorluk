import puppeteer from 'puppeteer-core';
const OUT = '/workspace/imparatorluk/shots19';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = []; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await browser.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') errors.push(m.text()); }); p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('dialog', (d) => void d.accept(d.type() === 'prompt' ? 'SIFIRLA' : undefined));
const I = (f, ...a) => p.evaluate(f, ...a);
const click = async (t, sel = 'button') => { const ok = await I((t, sel) => { const b = [...document.querySelectorAll(sel)].reverse().find((x) => x.textContent?.includes(t) && x.offsetParent); b?.click(); return !!b; }, t, sel); await sleep(400); return ok; };
const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await p.$('.modal:not(.trial-modal)'))) break; if (!(await click('Tamam'))) break; } };
const log = (...a) => console.log(...a);
const W = (fn, arg) => I((fn, arg) => { const k = 'imparatorluk-mock-v1'; const st = JSON.parse(localStorage.getItem(k)); new Function('w', 'arg', fn)(st.world, arg); localStorage.setItem(k, JSON.stringify(st)); }, fn, arg);
const meP = () => I(() => { const S = window.__imp(); const w = S.world; const pid = Object.values(w.players).find((x) => x.name === S.me)?.personId; return w.people.find((q) => q.id === pid); });
const act = async (a, wait = 1500) => { await I((a) => window.__imp().act(a), a); await sleep(wait); };
const waitFor = async (f, ms = 60000) => { for (let t = 0; t < ms; t += 700) { if (await f()) return true; await sleep(700); } return false; };
const sheet = () => I(() => document.querySelector('.sheet')?.innerText ?? '');
const closeSheet = () => I(() => document.querySelector('.sheet .x, .sheet button[title="Kapat"]')?.click());
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle0' }); await I(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
await click('Davetle kayıt'); let ins = await p.$$('.login input');
await ins[0].type('imparator'); await ins[1].type('Ahmet Enes'); await ins[2].type('kurucu@imparatorluk.local'); await ins[3].type('gizli123');
await click('Hesap aç'); await sleep(1800); await dismiss();
const w0 = await I(() => { const w = window.__imp().world; return { mps: w.meclis.seats.filter((s) => s.holder).length, seats: w.meclis.seats.length, next: w.election.nextDay, hayvan: !!w.buildings.find((b) => b.id === 'hayvan') }; });
log('K fresh world', w0);
log('K HUD emoji?', await I((r) => document.querySelector('.hud').innerText.match(new RegExp(r, 'gu')), emojiRe.source), 'svg icons', await I(() => document.querySelectorAll('.hud svg').length));
await p.screenshot({ path: `${OUT}/k1-landscape.png` });
// jailed Kayzer speed
let m; if (!process.env.CIT) {
const kid = (await meP()).id;
await W("const p=w.people.find(q=>q.id===arg); p.jailedDays=3;", kid); await p.reload({ waitUntil: 'networkidle0' }); await sleep(1500); await dismiss();
log('K jailed', (await meP()).jailedDays, 'speed ctl', await I(() => !!document.querySelector('.hud .speed')));
await I(() => [...document.querySelectorAll('.hud .speed button')].find((b) => b.textContent.includes('2'))?.click()); await sleep(2500);
log('K speed while jailed ->', await I(() => window.__imp().world.speed));
await I(() => [...document.querySelectorAll('.hud .speed button')].find((b) => b.textContent.includes('1'))?.click()); await sleep(1500);
await W("const p=w.people.find(q=>q.id===arg); p.jailedDays=0;", kid);
// animals: give money and buy at the Hayvan Pazarı
await W("const p=w.people.find(q=>q.id===arg); p.money=3000;", kid); await sleep(1200);
await I(() => window.__imp().openB('hayvan')); await sleep(600); log('K hayvan panel:', (await sheet()).replace(/\s+/g, ' ').slice(0, 260));
await p.screenshot({ path: `${OUT}/k2-hayvan.png` });
await act({ t: 'buyFarm' }, 0); await waitFor(async () => (await meP()).farm || (await meP()).barn !== undefined, 90000);
await act({ t: 'buildBarn', kind: 'ahir' }, 0); await waitFor(async () => (await meP()).barn?.ahir, 60000);
await act({ t: 'buyAnimal', animal: 'at' }, 0); await waitFor(async () => ((await meP()).animals?.at ?? 0) > 0, 90000);
await act({ t: 'buyAnimal', animal: 'inek' }, 0); await waitFor(async () => ((await meP()).animals?.inek ?? 0) > 0, 90000);
m = await meP(); log('K farm', { barn: m.barn, animals: m.animals, money: m.money });
await act({ t: 'feedAnimals' }, 0); await waitFor(async () => (await meP()).fedDay !== undefined, 90000);
await act({ t: 'collectFarm' }, 6000); m = await meP(); log('K fed', m.fedDay, 'stock', m.farmStock, 'last toast', await I(() => document.querySelector('.toast')?.innerText));
await I(() => window.__imp().openB('ciftlik')); await sleep(600); await p.screenshot({ path: `${OUT}/k3-farm.png` }); await closeSheet();
await act({ t: 'ride', on: true }, 1000); log('K riding', (await meP()).riding);
const sd = await I(() => { const S = window.__imp(); const b = S.world.buildings.find((x) => x.id === 'saray'); return S.toScreen(b.door.x + 0.5, b.door.y + 0.4); });
await p.touchscreen.tap(sd[0], sd[1]); await sleep(1200); await p.screenshot({ path: `${OUT}/k4-riding.png` });
// NPC smoothness: sample a walking NPC's display pos quickly
const tr = await I(async () => { const fr = []; for (let i = 0; i < 40; i++) { fr.push(Object.fromEntries(window.__imp().placed.filter((q) => q[3]).map((q) => [q[0], [q[1], q[2]]]))); await new Promise((r) => setTimeout(r, 100)); }
  const ids = Object.keys(fr[0]); let moving = 0, maxStep = 0, snaps = 0, steps = [];
  for (const id of ids) { let tot = 0; const st = []; for (let i = 1; i < fr.length; i++) { const a = fr[i - 1][id], b = fr[i][id]; if (!a || !b) continue; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); st.push(d); tot += d; } if (tot > 0.5) { moving++; maxStep = Math.max(maxStep, ...st); snaps += st.filter((d) => d > 0.6).length; steps.push(...st); } }
  const avg = steps.reduce((x, y) => x + y, 0) / Math.max(1, steps.length); return { visible: ids.length, moving, maxStep, snaps, avg }; });
log('K npc motion over 4s @100ms', tr);
await p.screenshot({ path: `${OUT}/k5-animals.png` });
// portrait overlay
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(600);
log('portrait overlay visible', await I(() => { const e = document.querySelector('.rotate-ov'); return !!e && getComputedStyle(e).display !== 'none'; }));
await p.screenshot({ path: `${OUT}/k6-portrait.png` });
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(600);
// admin reset
await I(() => window.__imp().admin()); await sleep(600);
const rs = await click('sıfırla', 'button.danger'); await sleep(2500); await dismiss();
log('K reset clicked', rs, await I(() => { const w = window.__imp().world; return { day: w.day, mps: w.meclis.seats.filter((s) => s.holder).length, next: w.election.nextDay, log: w.log?.[0]?.text ?? '' }; }));
}
// ---- citizen ----
await I(() => { for (const k of Object.keys(localStorage)) if (k.includes('session')) localStorage.removeItem(k); }); await p.reload({ waitUntil: 'networkidle0' });
await click('Davetle kayıt'); ins = await p.$$('.login input');
await ins[0].type('imparator'); await ins[1].type('Berat Vatandaş'); await ins[2].type('berat@x.com'); await ins[3].type('gizli123');
await click('Hesap aç'); await sleep(2000); await dismiss();
m = await meP(); log('C citizen', m.name, m.prof, 'home', m.home, 'speed ctl', await I(() => !!document.querySelector('.hud .speed')));
// hunger alert
log('C hunger before', m.hunger);
await W("const p=w.people.find(q=>q.id===arg); p.hunger=88;", m.id); await sleep(4000);
log('C hunger now', (await meP()).hunger, await I(() => [...document.querySelectorAll('.hud .meter')].map((e) => e.title).join(' | ')));
log('C hunger alert:', await I(() => document.querySelector('.alert-pop')?.innerText?.replace(/\s+/g, ' ')), 'flash', await I(() => !!document.querySelector('.hud .flash')));
await p.screenshot({ path: `${OUT}/c1-hunger.png` }); await I(() => document.querySelector('.alert-pop button:last-child')?.click());
await W("const p=w.people.find(q=>q.id===arg); p.hunger=20; p.money=500;", m.id);
// trial popup: inject a finished trial
const now = Date.now();
await W("w.cases.push({id:'tcase1',accusedId:arg.id,crime:'hirsizlik',victimId:null,amount:5,evidence:60,stage:'kapandi',day:w.day,deadline:w.day+2,verdict:'suclu',sentence:'2 gün zindan',trial:{at:arg.now-60000,until:arg.now,judgeId:null,prosecutorId:null,msgs:[],persuasion:0,done:true,doneAt:arg.now,verdictText:'Suçlu bulundu.'}}); w.cases.push({id:'tcase2',accusedId:arg.id,crime:'hirsizlik',victimId:null,amount:5,evidence:60,stage:'kapandi',day:w.day,deadline:w.day+2,verdict:'dusuruldu',sentence:'Aynı olay için dava zaten görüldü.',trial:{at:arg.now-60000,until:arg.now,judgeId:null,prosecutorId:null,msgs:[],persuasion:0,done:true,doneAt:arg.now}});", { id: m.id, now });
await sleep(3000); log('C cases', await I((id) => window.__imp().world.cases.filter((c) => c.accusedId === id).map((c) => c.id + ':' + c.stage), m.id)); const t1 = await I(() => document.querySelectorAll('.trial-modal').length); log('C trial popup shown', t1);
await p.screenshot({ path: `${OUT}/c2-trial.png` });
await I(() => [...document.querySelectorAll('.trial-modal button')].find((b) => /Tamam|Kapat/.test(b.textContent))?.click()); await sleep(3500);
const t2 = await I(() => document.querySelectorAll('.trial-modal').length); await p.reload({ waitUntil: 'networkidle0' }); await sleep(6000); const t3 = await I(() => document.querySelectorAll('.trial-modal').length); await dismiss();
log('C trial popup after close', t2, 'after reload', t3);
if (process.env.CIT) { log('ERRORS', errors); await browser.close(); process.exit(0); }
// house: find house with room that is not mine
const hid = await I((mh) => { const w = window.__imp().world; return w.buildings.filter((b) => b.kind === 'ev' && b.id !== mh).find((b) => w.people.filter((q) => q.home === b.id).length < 5)?.id; }, m.home);
await I((id) => window.__imp().openB(id), hid); await sleep(600); log('C house panel:', (await sheet()).replace(/\s+/g, ' ').slice(0, 200));
await p.screenshot({ path: `${OUT}/c3-house.png` });
await act({ t: 'rentHome', houseId: hid }, 0); await waitFor(async () => (await meP()).home === hid, 90000);
m = await meP(); log('C rented', m.home, m.renting, 'money', m.money);
await act({ t: 'goHome', sleep: true }, 0); await waitFor(async () => (await meP()).sleeping, 90000);
m = await meP(); log('C sleeping', m.sleeping, 'homeUntil>now', (m.homeUntil ?? 0) > Date.now());
await I((id) => window.__imp().openB(id), hid); await sleep(600); await p.screenshot({ path: `${OUT}/c4-home.png` }); await closeSheet();
await act({ t: 'leaveHome' }, 1500);
// org + invite via card
await act({ t: 'orgFound', kind: 'hirsiz', name: 'Kara Kalem' }, 2500);
log('C orgs', await I(() => window.__imp().world.orgs?.map((o) => o.name + ':' + o.members.length)));
await I(() => window.__imp().menu('cemiyet')); await sleep(600); await p.screenshot({ path: `${OUT}/c5-cemiyet.png` }); await closeSheet();
// meclis: set candidacy phase and run
await W("w.election.nextDay=w.day+9;", null); await sleep(1500);
await I(() => window.__imp().openB('meclis')); await sleep(600); const ac = await click('Aday ol'); await sleep(500);
await waitFor(async () => I(() => { const S = window.__imp(); const w = S.world; const pid = Object.values(w.players).find((x) => x.name === S.me)?.personId; return w.election.candidates.includes(pid); }), 90000);
log('C aday ol clicked', ac, 'candidate', await I(() => { const S = window.__imp(); const w = S.world; const pid = Object.values(w.players).find((x) => x.name === S.me)?.personId; return w.election.candidates.includes(pid); }));
await I(() => window.__imp().openB('meclis')); await sleep(600); await p.screenshot({ path: `${OUT}/c6-meclis.png` });
log('C meclis locked text', (await sheet()).includes('kilitli'));
log('ERRORS', errors.slice(0, 8));
await browser.close();
