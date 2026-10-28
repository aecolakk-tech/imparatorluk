import { boot, sleep } from './play-lib.mjs';
const T = await boot('Mevsim Test'); const { I, p } = T; const log = (...a) => console.log(...a);
await p.evaluateOnNewDocument?.(() => {});
// seasons: day 1 ilkbahar, 31 yaz, 61 sonbahar, 91 kış
for (const [d, s] of [[5, 'ilkbahar'], [35, 'yaz'], [65, 'sonbahar'], [95, 'kis']]) {
  await T.W("w.day=arg; w.hour=12;", d); await sleep(3500); await I(() => window.__imp().look(36, 24)); await T.dismiss(); await sleep(1500);
  const hud = await I(() => document.querySelector('.hud')?.innerText.split('\n').slice(0, 3).join(' ')); await p.screenshot({ path: `perf/season-${s}.png` }); log('season', s, '| hud:', hud);
}
await T.W("w.day=12;"); await sleep(3000);
// hunger ≤15 popup + vibrate call
await I(() => { window.__vib = []; navigator.vibrate = (x) => { window.__vib.push(x); return true; }; });
const me = await T.me(); await T.W("const p=w.people.find(q=>q.id===arg); p.hunger=88; p.thirst=20;", me.id); await sleep(5000);
log('popup:', (await I(() => document.querySelector('.alert-pop')?.innerText ?? 'none')).replace(/\s+/g, ' '), '| vibrate calls:', JSON.stringify(await I(() => window.__vib)));
await T.click('Ye'); await sleep(3500); log('after Ye:', (await T.me()).hunger, await T.toasts());
await T.W("const p=w.people.find(q=>q.id===arg); p.thirst=92;", me.id); await sleep(5000);
log('thirst popup:', (await I(() => document.querySelector('.alert-pop')?.innerText ?? 'none')).replace(/\s+/g, ' '), '| vibrate calls:', (await I(() => window.__vib.length)));
// night music: tap to unlock audio, enable music, set night, measure output with an analyser on the master
await I(() => { localStorage.setItem('imp-music', '1'); }); 
const audio = await I(async () => {
  // render the night track offline and measure RMS
  const mod = await import('/src/ui/sound.ts'); const OAC = window.OfflineAudioContext; const ctx = new OAC(1, 44100 * 12, 44100);
  const ok = typeof mod.renderNightForTest === 'function'; if (!ok) return 'no test hook';
  const outDay = await mod.renderNightForTest(ctx, 'gece'); const ctx2 = new OAC(1, 44100 * 12, 44100); const outD = await mod.renderNightForTest(ctx2, 'gun');
  return { nightRms: outDay.rms, nightPeak: outDay.peak, dayRms: outD.rms, dayPeak: outD.peak };
});
log('audio', JSON.stringify(audio));
await T.W("w.hour=22;"); await sleep(3500); log('mood 22h', await I(() => window.__imp().mood())); await T.W("w.hour=7;"); await sleep(3500); log('mood 07h', await I(() => window.__imp().mood()));
log('errors', T.errors); await T.b.close();
