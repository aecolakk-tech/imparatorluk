// v2.0.3: every visible button in an open panel must be the top element at its own centre (nothing invisible/overlapping steals the tap).
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Hit Test'); const { I, p } = T; const log = (...a) => console.log(...a);
const me0 = await T.me(); await T.W("const p=w.people.find(q=>q.id===arg); p.lookSet=true; p.genderSet=true; p.profile={...(p.profile||{}), set:true, surname:'Test', age:'genc', origin:'koylu', temper:'sakin'}; p.onboardUntil=0;", me0.id);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(3000); await T.dismiss();
const check = () => I(() => { const s = document.querySelector('.sheet:not(.leave)'); if (!s) return 'NO SHEET'; const bad = []; let n = 0;
  for (const b of s.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const sr = s.getBoundingClientRect(); const cy = r.top + r.height / 2; if (cy < sr.top || cy > sr.bottom || cy > innerHeight) continue; n++;
    const t = document.elementFromPoint(r.left + r.width / 2, cy); if (!b.contains(t)) bad.push(`${b.textContent.trim().slice(0, 20)} ← ${t?.tagName}.${t?.className?.baseVal ?? t?.className} "${(t?.textContent ?? "").trim().slice(0, 20)}" in ${t?.parentElement?.className}/${t?.parentElement?.parentElement?.className}`); }
  return `${n} buttons, blocked: ${bad.length ? bad.join(' | ') : 'none'}`; });
for (const id of ['pazar', 'saray', 'mahkeme', 'bar', 'liman', 'kisla']) { await I((id) => window.__imp().openB(id), id); await sleep(700); log(id, await check()); await I(() => { const s = document.querySelector('.sheet'); if (s) s.scrollTop = s.scrollHeight; }); await sleep(300); log(id, '(scrolled)', await check()); }
for (const sec of ['ben', 'yap', 'ayar']) { await I((s) => window.__imp().menu(s), sec); await sleep(700); log('menu', sec, await check()); }
// 60 s of live play with a panel open: periodic pop-ups (alerts, events, toasts) must never block a panel button or Menü
await I(() => window.__imp().openB('pazar')); await sleep(500);
const me1 = await T.me(); await T.W("const p=w.people.find(q=>q.id===arg); p.hunger=90; p.thirst=90;", me1.id);
const seen = new Set(); for (let i = 0; i < 30; i++) { const r = await check(); if (!/blocked: none/.test(r)) seen.add(r.replace(/^\d+ buttons, /, '')); const mh = await I(() => { const b = [...document.querySelectorAll('.dock button')].find((x) => /Menü/.test(x.textContent)); if (!b) return 'no menu'; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b.contains(t) ? '' : 'MENU BLOCKED by ' + (t?.className?.baseVal ?? t?.className); }); if (mh) seen.add(mh); await sleep(2000); }
log('during 60 s play:', seen.size ? [...seen].join(' || ') : 'nothing ever blocked');
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
