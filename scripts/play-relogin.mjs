// Freeze repro: login → logout → login again → Menü must open; only one frame loop / tick loop; world keeps moving.
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Relog Test'); const { I, p } = T; const log = (...a) => console.log(...a);
const wrap = () => { if (window.__rafWrapped) return; window.__rafWrapped = 1; window.__rafN = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => o((t) => { window.__rafN++; f(t); }); };
await p.evaluateOnNewDocument(wrap); await I(wrap);
const hit = () => I(() => { const b = [...document.querySelectorAll('.dock button')].find((x) => /Menü/.test(x.textContent)); if (!b) return 'no-menu'; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b.contains(t) ? 'menu-on-top' : 'BLOCKED by ' + (t?.className || t?.tagName); });
const rate = async () => { const a = await I(() => window.__rafN); await sleep(2000); return ((await I(() => window.__rafN)) - a) / 2; };
const hbRate = async () => { const a = await I(() => (window.__hb ?? []).length); await sleep(7600); return (await I(() => (window.__hb ?? []).length)) - a; };
const menuOpens = async () => { await I(() => document.querySelector('.sheet .close')?.click()); await sleep(400); await I(() => [...document.querySelectorAll('.dock button')].find((b) => /Menü/.test(b.textContent))?.click()); await sleep(700); return I(() => !!document.querySelector('.sheet') && document.querySelector('.sheet').isConnected && document.querySelector('.sheet').getBoundingClientRect().width > 0); };
const me0 = await T.me(); await T.W("const p=w.people.find(q=>q.id===arg); p.lookSet=true; p.genderSet=true; p.profile={...(p.profile||{}), set:true, surname:'Test', age:'genc', origin:'koylu', temper:'sakin'}; p.onboardUntil=0; const pl=Object.values(w.players).find(x=>x.personId===arg); if(pl){pl.onboarded=true; pl.quest=99;}", me0.id);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(3000); await T.dismiss(); await I(() => document.querySelector('.look-modal')?.remove());
log('before: hit', await hit(), 'raf/s', await rate(), 'hb/7.6s', await hbRate(), 'menu', await menuOpens());
for (let k = 0; k < 2; k++) {
  await I(() => window.__imp().menu('ayar')); await sleep(500); log('logout clicked', await T.click('Çıkış')); await sleep(2500);
  await I(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Giriş')?.click()); await sleep(200);
  await p.waitForSelector('.login input', { timeout: 10000 }); const ins = await p.$$('.login input'); await ins[0].type('RelogTest@x.com'); await ins[1].type('gizli123');
  await I(() => [...document.querySelectorAll('.login button')].reverse().find((x) => /Giriş yap|Giriş/.test(x.textContent))?.click()); await sleep(3500); await T.dismiss();
  log(`after relogin ${k + 1}: hit`, await hit(), 'raf/s', await rate(), 'hb/7.6s', await hbRate(), 'menu', await menuOpens());
}
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
