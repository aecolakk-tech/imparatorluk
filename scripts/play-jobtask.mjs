// v2.0.3 İş görevi UI: arrive at work → hint toast; building panel → "İş görevi yap"; 3 steps; Menü → İşin shows "Bugün n/3 görev".
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Gorev Test'); const { I, p } = T; const log = (...a) => console.log(...a);
const me0 = await T.me();
await T.W("const p=w.people.find(q=>q.id===arg); p.lookSet=true; p.genderSet=true; p.profile={...(p.profile||{}), set:true, surname:'Test', age:'genc', origin:'koylu', temper:'sakin'}; p.onboardUntil=0; p.prof='firinci'; p.work='firin'; p.job={id:'JT1',title:'Fırın işçisi',place:'firin',prof:'firinci',wage:5,from:6,to:14,employerId:'dis',kind:'gundelik',hiredDay:w.day-1}; p.walk=undefined;", me0.id);
await p.evaluateOnNewDocument(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.innerText); }).observe(document, { childList: true, subtree: true }); });
await p.reload({ waitUntil: 'networkidle0' }); await sleep(3000); await T.dismiss();
await I(() => { const S = window.__imp(); const b = S.world.buildings.find((x) => x.id === 'firin'); S.act({ t: 'move', x: b.door.x + 0.5, y: b.door.y + 0.8 }); });
let hint = ''; for (let i = 0; i < 30 && !hint; i++) { const t = await T.toasts(); if (/İş yerindesiniz/.test(t)) hint = t; await sleep(500); }
log('my pos vs firin door', JSON.stringify(await I((id) => { const S = window.__imp(); const q = S.placed.find((x) => x[0] === id); const b = S.world.buildings.find((x) => x.id === 'firin'); return [q, b.door]; }, me0.id)));
log('hint toast:', hint.slice(0, 200) || 'NONE', '| all toasts:', JSON.stringify(await I(() => window.__toasts)).slice(0, 600));
await I(() => window.__imp().openB('firin')); await sleep(800);
log('panel card:', await I(() => document.querySelector('.jt-card')?.innerText.replace(/\s+/g, ' ') ?? 'NO CARD'));
await T.click('İş görevi yap'); await sleep(1200);
log('modal:', await I(() => document.querySelector('.jobtask')?.innerText.replace(/\s+/g, ' ').slice(0, 200) ?? 'NO MODAL'));
const t0 = Date.now(); let taps = 0;
while (Date.now() - t0 < 40_000) { const r = await I(() => { const b = document.querySelector('.jobtask .jt-go'); if (b && !b.disabled) { b.click(); return 1; } return document.querySelector('.jobtask .jt-go') ? 0 : -1; }); if (r === 1) taps++; if (r === -1) break; await sleep(300); }
await sleep(2500);
log('taps', taps, 'secs', Math.round((Date.now() - t0) / 1000), '| result:', await I(() => document.querySelector('.jobtask')?.innerText.replace(/\s+/g, ' ').slice(0, 250) ?? 'closed'));
await p.screenshot({ path: '/workspace/imparatorluk/perf/jobtask-done.png' });
await I(() => [...document.querySelectorAll('.jobtask button')].find((b) => /Kapat/.test(b.textContent))?.click()); await sleep(500);
await I(() => window.__imp().menu('ben')); await sleep(1000);
log('career card:', (await T.sheet()).match(/İşin[\s\S]{0,200}/)?.[0]?.replace(/\s+/g, ' ') ?? 'no İşin section');
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
