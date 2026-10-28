// v2.0.3: the tap that opens a panel must not also land on the new panel (its ✕ / a button under the finger).
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Ghost Test'); const { I, p } = T; const log = (...a) => console.log(...a);
const me0 = await T.me(); await T.W("const p=w.people.find(q=>q.id===arg); p.lookSet=true; p.genderSet=true; p.profile={...(p.profile||{}), set:true, surname:'Test', age:'genc', origin:'koylu', temper:'sakin'}; p.onboardUntil=0;", me0.id);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(3000); await T.dismiss();
for (const id of ['saray', 'mahkeme']) {
  await I(() => document.querySelector('.sheet .close')?.click()); await sleep(600); await I(() => document.querySelector('.look-modal')?.remove());
  // 1) the press starts (finger down), 2) the app opens the panel, 3) the browser's click for that press arrives on the ✕ under the finger
  const r = await I((id) => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.__imp().openB(id);
    const x = document.querySelector('.sheet .close'); x.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })); return !!x; }, id);
  await sleep(1500); const s1 = await I(() => document.querySelector('.sheet:not(.leave) h2')?.textContent ?? 'NONE');
  // a fresh, real tap on ✕ still closes it
  await I(() => document.querySelector('.look-modal')?.remove()); await sleep(1200); const xy = await I(() => { const r = document.querySelector('.sheet .close').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  log('top at ✕', await I((xy) => { const t = document.elementFromPoint(xy[0], xy[1]); return (t?.className || t?.tagName) + ' in ' + (t?.closest('.sheet,.modal,.app-dialog')?.className ?? '-'); }, xy)); await p.touchscreen.tap(...xy); await sleep(800); const s2 = await I(() => document.querySelector('.sheet:not(.leave)') ? 'OPEN' : 'CLOSED');
  log(id, 'ghost click swallowed →', s1, s1 !== 'NONE' ? 'STAYS ✅' : 'CLOSED ❌', '| real ✕ tap →', s2, s2 === 'CLOSED' ? '✅' : '❌', r);
}
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
