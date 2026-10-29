// v2.1.0 tek kişilik end-to-end: new game → walk → buy → job task → reload → Devam Et → same state; export → import; no game-server calls.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL0 = process.env.URL ?? 'http://localhost:4173/?debug';
const out = []; const log = (...a) => { console.log(...a); out.push(a.join(' ')); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; const net = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('blob:')) net.push(u); });
const dl = '/tmp/solo-dl'; mkdirSync(dl, { recursive: true });
const cdp = await p.target().createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
const I = (f, ...a) => p.evaluate(f, ...a);
const click = async (t, sel = 'button') => { const ok = await I((t, sel) => { const x = [...document.querySelectorAll(sel)].reverse().find((x) => x.textContent?.includes(t) && x.offsetParent); x?.click(); return !!x; }, t, sel); await sleep(400); return ok; };
const dismiss = async () => { for (let i = 0; i < 14; i++) { const ok = await I(() => { const x = [...document.querySelectorAll('.modal:not(.trial-modal) button, .a2hs button')].find((x) => /Tamam|Kapat|Atla|Geç|Harika|Sonra|Anladım|Kaydet|Başla|✕/.test(x.textContent)); x?.click(); return !!x; }); if (!ok) break; await sleep(400); } };
const S = (code, arg) => I((code, arg) => new Function('be', 'w', 'me', 'arg', code)(window.__solo, window.__solo.st?.world, window.__solo.st && window.__solo.st.world.people.find((q) => q.id === window.__solo.st.world.players.solo.personId), arg), code, arg);
const state = () => S("return { money: +me.money.toFixed(4), inv: JSON.stringify(me.inv), day: w.day, hour: w.hour, x: me.x, y: me.y, tasks: me.job ? (me.job.tasks ?? null) : null, people: w.people.length, name: me.name, look: !!me.lookSet };");

await p.goto(URL0, { waitUntil: 'networkidle0' }); await I(async () => { localStorage.clear(); localStorage.setItem('imp-guide-done', '1'); localStorage.setItem('imp-music', '0'); await new Promise((r) => { const q = indexedDB.deleteDatabase('imparatorluk-solo'); q.onsuccess = q.onerror = q.onblocked = r; }); });
await p.reload({ waitUntil: 'networkidle0' }); await sleep(800);
log('menu:', (await I(() => document.querySelector('.solo-menu')?.innerText.replace(/\s+/g, ' '))) ?? 'NO MENU');
await click('Yeni Oyun'); const inp = await p.$('.solo-menu input'); await inp.type('Zeynel Testoğlu'); await click('Başla'); await sleep(2500);
log('after start, modal:', (await I(() => document.querySelector('.modal')?.innerText.replace(/\s+/g, ' ').slice(0, 160))) ?? 'none');
await dismiss(); await sleep(1000); await dismiss();
log('state0', JSON.stringify(await state()));
// skip the intro + make the morning market open (test speed-up), then walk to the market and buy bread through the real action path
await S("me.lookSet=true; me.genderSet=true; me.profile={...(me.profile||{}), set:true, surname:'Test', age:'genc', origin:'koylu', temper:'sakin'}; me.onboardUntil=0;");
await I(() => window.__imp().act({ t: 'setSpeed', speed: 2 })); await sleep(800);
log('speed after 2x click:', await S('return w.speed;'));
for (let i = 0; i < 90; i++) { const hr = await S('return w.hour;'); if (hr >= 9) break; await sleep(1000); }
log('hour now', await S('return w.hour;'));
const mk = await S("const b=w.buildings.find(x=>x.id==='pazar'||x.kind==='pazar'); return b ? {id:b.id, x:b.door?.x ?? b.x, y:b.door?.y ?? b.y} : null;");
await I((m) => window.__imp().act({ t: 'move', x: m.x + 0.5, y: m.y + 0.8 }), mk); await sleep(9000);
const before = await state();
const buy = await I(async () => { const S2 = window.__imp(); return S2.act({ t: 'buy', good: 'ekmek', qty: 1 }); }); await sleep(1500);
const afterBuy = await state(); log('buy: money', before.money, '→', afterBuy.money, 'inv', afterBuy.inv, 'toasts', await I(() => [...document.querySelectorAll('.toast')].map((x) => x.innerText).join(' | ')), String(buy ?? ''));
// job task: give a bakery job (test shortcut), walk there, do the 3-step task in the UI
await S("me.prof='firinci'; me.work='firin'; me.job={id:'JT1',title:'Fırın işçisi',place:'firin',prof:'firinci',wage:5,from:6,to:20,employerId:'dis',kind:'gundelik',hiredDay:w.day-1};");
await I(() => { const S2 = window.__imp(); const b = S2.world.buildings.find((x) => x.id === 'firin'); S2.act({ t: 'move', x: b.door.x + 0.5, y: b.door.y + 0.8 }); }); await sleep(12000);
await I(() => window.__imp().openB('firin')); await sleep(800); await click('İş görevi yap'); await sleep(1000);
const t0 = Date.now(); let taps = 0;
while (Date.now() - t0 < 45_000) { const r = await I(() => { const x = document.querySelector('.jobtask .jt-go'); if (x && !x.disabled) { x.click(); return 1; } return document.querySelector('.jobtask .jt-go') ? 0 : -1; }); if (r === 1) taps++; if (r === -1) break; await sleep(300); }
await sleep(2000); log('job task taps', taps, 'result:', (await I(() => document.querySelector('.jobtask')?.innerText.replace(/\s+/g, ' ').slice(0, 200))) ?? 'closed');
await I(() => [...document.querySelectorAll('.jobtask button')].find((x) => /Kapat/.test(x.textContent))?.click());
const s1 = await state(); log('state1', JSON.stringify(s1));
// reload → Devam Et
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(500);
await I(() => window.__solo.saveNow()); await sleep(500);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(800);
log('menu after reload:', await I(() => document.querySelector('.solo-menu')?.innerText.replace(/\s+/g, ' ')));
await click('Devam Et'); await sleep(2500); await dismiss();
const s2 = await state(); log('state2', JSON.stringify(s2));
const same = (a, c) => a.money === c.money && a.inv === c.inv && a.day === c.day && Math.abs(a.hour - c.hour) <= 1 && a.name === c.name && a.people === c.people;
log('RESTORE SAME:', same(s1, s2));
// export → file
await I(() => window.__imp().menu('ayar')); await sleep(800);
log('settings has Kayıt:', await I(() => /Kaydı dışa aktar/.test(document.querySelector('.sheet')?.innerText ?? '')));
await click('Kaydı dışa aktar'); await sleep(2500);
const files = (await import('node:fs')).readdirSync(dl).filter((f) => f.endsWith('.json')); log('exported files', files.join(','));
const exp = JSON.parse(readFileSync(`${dl}/${files.at(-1)}`, 'utf8')); log('export format', exp.format, 'day', exp.day, 'size KB', Math.round(JSON.stringify(exp).length / 1024));
// change state, then import the file → back to the exported state
await S("me.money += 500;"); const sMod = await state();
const fi = await p.$('.save-set input[type=file]'); await fi.uploadFile(`${dl}/${files.at(-1)}`); await sleep(800); await click('Yükle', '.app-dialog button'); await sleep(3500); await dismiss();
const s3 = await state(); log('after import: money', sMod.money, '→', s3.money, 'export money', exp.world.people.find((q) => q.id === exp.world.players.solo.personId).money.toFixed(4));
log('IMPORT RESTORED:', Math.abs(s3.money - exp.world.people.find((q) => q.id === exp.world.players.solo.personId).money) < 0.01);
const prof = await I(() => window.__imp().profile()); log('frame cpu', JSON.stringify(prof));
log('tick ms (UI per update) max', await I(() => Math.max(...(window.__tickMs ?? [0]))));
await p.screenshot({ path: '/workspace/imparatorluk/perf/solo-final.png' });
// second start: 'Kayzer olarak başla' with a random empire name
await I(async () => { await new Promise((r) => { const q = indexedDB.deleteDatabase('imparatorluk-solo'); q.onsuccess = q.onerror = q.onblocked = r; }); });
await p.reload({ waitUntil: 'networkidle0' }); await sleep(800); await click('Yeni Oyun');
log('halk start info:', await I(() => document.querySelector('.solo-menu .muted')?.innerText.slice(0, 90)), '| empire field visible (halk):', await I(() => !!document.querySelector('.empire-name')?.offsetParent));
await (await p.$('.solo-menu input')).type('Kayzer Testoğlu'); await click('Kayzer olarak başla'); await click('Rastgele');
log('empire field visible (kayzer):', await I(() => !!document.querySelector('.empire-name')?.offsetParent), 'value:', await I(() => document.querySelector('.empire-name').value));
await click('Başla'); await sleep(2500); await dismiss();
log('kayzer start:', JSON.stringify(await S("return { me: me.name, kayzer: w.kayzerId === me.id, empire: w.empireName, trait: w.rulerTrait ?? null };")));
log('external requests:', net.length ? net.join(' ') : 'NONE');
log('errors:', JSON.stringify(errors.slice(0, 8)));
await b.close();
