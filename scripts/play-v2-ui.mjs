// v2.0 UI: what's new, empire name, Çanta, Demirci, event popups, map overlays, perf.
import { boot, sleep } from './play-lib.mjs';
const T = await boot('Yeni Oyuncu');
const out = (k, v) => console.log(k, typeof v === 'string' ? v.slice(0, 300) : JSON.stringify(v));
out('modals after boot', await T.I(() => [...document.querySelectorAll('.modal h2')].map((x) => x.textContent)));
await T.p.screenshot({ path: 'perf/v2-boot.png' });
await T.I(() => document.querySelectorAll('.modal').forEach((x) => x.remove()));
// give weapons + food, set events
const meId = (await T.me()).id;
await T.W(`const p = w.people.find((x) => x.id === arg); p.arms = { kilic: 1, yay: 1, ok: 12, kalkan: 1 }; p.inv.ekmek = 3; p.inv.su = 2; p.money = 400; p.infected = { day: w.day }; p.jailedDays = 0; w.cases = w.cases.filter((c) => c.accusedId !== arg); w.arrests = []; w.kayzerId = arg;
  w.caravan = { day: w.day, until: w.day + 1, hour: w.hour, goods: { ekmek: 10 }, name: 'Halep kervanı', arriveAt: Date.now() - 200000, ship: false };
  w.raid = { phase: 'gece', day: w.day, robbers: Array.from({ length: 10 }, (_, i) => ({ id: 'R' + i, hp: 2 })) };
  w.foreign = { name: 'Venedik Cumhuriyeti', demand: 3000, troops: 16, phase: 'savas', day: w.day, deadline: w.day, landDay: w.day, landed: true, landAt: Date.now() - 30000, alive: 16, recruits: [] };
  const ev = w.buildings.find((b) => b.kind === 'ev'); ev.burned = { day: w.day, prevOwner: null }; w.fire = { bid: 'atolye', startH: w.day * 24 + w.hour, cause: 'test' };
  const id = (w.disaster?.id ?? 0); w.notices = [{ id: id + 1, kind: 'baskin_uyari', text: 'Bu gece silahlı eşkıya bekleniyor! (test)', day: w.day }, { id: id + 2, kind: 'devlet', text: 'Elçi geldi (test)', day: w.day }]; w.disaster = w.notices[1];`, meId);
await T.p.reload({ waitUntil: 'networkidle0' }); await sleep(4000);
out('popups', await T.I(() => [...document.querySelectorAll('.modal h2')].map((x) => x.textContent)));
await T.p.screenshot({ path: 'perf/v2-popups.png' });
await T.I(() => document.querySelectorAll('.modal').forEach((x) => x.remove()));
out('state', await T.I(() => { const w = window.__imp().world; return { raid: !!w.raid, foreign: w.foreign?.alive, caravan: w.caravan?.name, fire: w.fire?.bid, burned: w.buildings.filter((b) => b.burned).length }; }));
out('hud', await T.I(() => document.querySelector('.hud')?.innerText.replace(/\n/g, ' | ')));
await sleep(1500); await T.I(() => document.querySelectorAll('.modal, .a2hs').forEach((x) => x.remove())); for (let i = 0; i < 5; i++) { await T.I(() => window.__imp().look(58, 46)); await sleep(60); } await T.p.screenshot({ path: 'perf/v2-map-war.png' });
await T.I(() => document.querySelectorAll('.modal, .a2hs').forEach((x) => x.remove())); for (let i = 0; i < 5; i++) { await T.I(() => window.__imp().look(30, 24)); await sleep(60); } out('pazar on screen', await T.I(() => window.__imp().toScreen(36, 28.6))); await sleep(500); out('pazar later', await T.I(() => window.__imp().toScreen(36, 28.6))); await T.p.screenshot({ path: 'perf/v2-map-caravan.png' });
// Çanta
await T.click('Menü'); await sleep(500); await T.click('Çanta'); await sleep(600);
out('canta', await T.sheet()); await T.p.screenshot({ path: 'perf/v2-canta.png' });
await T.click('Çek'); await sleep(1500); out('after draw toast', await T.toasts()); out('drawn', (await T.me()).drawn); out('jail', await T.W("const p = w.people.find((x) => x.id === arg); return [p.jailedDays, w.arrests.filter((a) => a.criminalId === arg).map((a) => a.crime + ' ' + a.basis), (w.log || []).filter((l) => l.personId === arg).slice(-5).map((l) => l.text)]", meId));
await T.click('Ye'); await sleep(1500); out('after eat', await T.toasts());
// perf
const prof = await T.I(async () => { const S = window.__imp(); await new Promise((r) => setTimeout(r, 4000)); let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return { fps: +(n / 3).toFixed(1), ...S.profile() }; });
out('perf', prof);
out('errors', T.errors);
await T.b.close();
