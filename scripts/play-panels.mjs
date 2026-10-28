// Panels must stay open at Saray / Mahkeme etc. until the player closes them.
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Panel Test'); const { I } = T; const log = (...a) => console.log(...a);
await I(() => { const f = [...document.querySelectorAll('.look-modal input')]; }); await T.dismiss();
log('modals', await I(() => [...document.querySelectorAll('.modal')].map((m) => m.className).join(',')));
for (const id of ['saray', 'mahkeme', 'pazar', 'kisla', 'meyhane']) {
  await I((id) => window.__imp().openB(id), id); await sleep(400);
  const seen = [];
  for (let i = 0; i < 25; i++) { seen.push(await I(() => { const s = document.querySelector('.sheet:not(.leave)'); return s ? (s.querySelector('h2,h3')?.textContent ?? '?').slice(0, 18) : 'NONE'; })); await sleep(1000); }
  const uniq = [...new Set(seen)]; log(id, uniq.length === 1 && uniq[0] !== 'NONE' ? 'STABLE' : 'CHANGED', JSON.stringify(uniq));
}
log('errors', JSON.stringify(T.errors.slice(0, 5))); await T.b.close();
