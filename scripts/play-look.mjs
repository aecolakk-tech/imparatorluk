import { boot, sleep } from './play-lib.mjs';
const T = await boot('Look Test');
await sleep(1500);
await 0; console.log('creator open:', await T.I(() => !!document.querySelector('.look-modal')), '| rows:', await T.I(() => document.querySelectorAll('.look-modal .look-row').length));
await T.click('Rastgele'); await sleep(300); await T.click('›'); await sleep(200);
await T.p.screenshot({ path: 'perf/look-creator.png' });
await T.click('Kaydet'); await sleep(2500);
const m = await T.me(); console.log('saved look:', JSON.stringify(m.look), 'lookSet', m.lookSet);
await T.W("const p=w.people.find(q=>q.id===arg); p.money=100;", m.id); await sleep(6500);
await T.I(() => window.__openLook('berber')); await sleep(400); await T.click('›'); await T.click('Öde ve değiştir'); for (let i = 0; i < 12; i++) { await sleep(2500); const t = await T.toasts(); const mm = await T.me(); console.log('  t', i, t.slice(0, 90), '| pos/money', Math.round(mm.money), 'walk', !!mm.walk); if (mm.look.hair !== 9 && i > 1) break; }
const m2 = await T.me(); console.log('after berber: money', Math.round(m2.money), 'hair', m2.look.hair, '| toasts', await T.toasts());
await T.p.screenshot({ path: 'perf/look-map.png' });
console.log('errors:', T.errors.join(' | ') || 'none'); await T.b.close();
