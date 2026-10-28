// v2.0.2 UI sweep (mock, 844x390): every menu/building/Meclis tab for broken text; campaign + party + Göstergesi + family screenshots.
import { boot, sleep } from './play-lib.mjs';
const OUT = '/workspace/raid/v202'; const T = await boot('Arayuz Test'); const { I, p } = T; const issues = []; const log = (...a) => console.log(...a);
const txt = () => I(() => (document.querySelector('.sheet')?.innerText ?? '') + ' ' + [...document.querySelectorAll('.modal')].map((m) => m.innerText).join(' '));
const check = async (label) => { const t = await txt(); const m = t.match(/\[object [A-Za-z]+\]|undefined|NaN|\bnull\b|Bekçi Bekçi|!\./g); if (m) issues.push(`${label}: ${[...new Set(m)].join(',')}`); return t.length; };
const me0 = await T.me();
await T.W(`const me = w.people.find((q) => q.id === arg); me.lookSet = true; me.genderSet = true; me.profile = { ...(me.profile ?? {}), set: true }; me.onboardUntil = 0; me.money = 400; me.itibar = 45; me.meclis = true;
  w.election.nextDay = w.day + 3; if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id); me.faction = w.meclis.factions[0].id; w.election.vaat = { ...(w.election.vaat ?? {}), [me.id]: ['ambar', 'asevi'] };
  for (const k of Object.keys(w.whatsNew ?? {})) w.whatsNew[k] = 'v9';`, me0.id);
await p.reload({ waitUntil: 'networkidle0' }); await sleep(2500); await T.dismiss();
for (const s of ['yap', 'canta', 'hedef', 'cemiyet', 'ben', 'mesaj', 'aile', 'gazete', 'ayar', 'meclis', 'tarih', 'olay', 'kural']) { await I((s) => window.__imp().menu(s), s); await sleep(400); await check('menu ' + s); }
// P9: menu tab strip scrolls on 844x390 (all tabs reachable)
log('tabs scroll', JSON.stringify(await I(() => { const t = document.querySelector('.sheet .tabs, .menu-tabs, .sheet-tabs'); return t ? { sw: t.scrollWidth, cw: t.clientWidth, ov: getComputedStyle(t).overflowX } : null; })));
await I(() => window.__imp().menu('ben')); await sleep(500); await p.screenshot({ path: `${OUT}/ben.png` });
const bids = await I(() => window.__imp().world.buildings.map((b) => b.id));
for (const id of bids) { await I((id) => window.__imp().openB(id), id); await sleep(140); await check('building ' + id); }
log('buildings checked', bids.length);
// Meclis full-screen: every tab
await T.dismiss(); await I(() => window.__imp().openB('meclis')); await sleep(700); await I(() => document.querySelectorAll('.modal').forEach((m) => { if (!m.querySelector('.meclis-full')) [...m.querySelectorAll('button')].find((b) => /Tamam/.test(b.textContent))?.click(); })); await sleep(300);
for (const t of ['Gündem', 'Teklif Ver', 'Geçmiş', 'Üyeler', 'Partiler', 'Seçim-Kampanya']) { await T.click(t, '.meclis-full .tabs button'); await sleep(350); await check('meclis ' + t); await I(() => [...document.querySelectorAll('.modal button')].filter((b) => /^Tamam$/.test(b.textContent.trim())).forEach((b) => b.click())); await sleep(200);
  if (t === 'Partiler') await p.screenshot({ path: `${OUT}/meclis-partiler.png` }); if (t === 'Seçim-Kampanya') await p.screenshot({ path: `${OUT}/meclis-kampanya.png` }); if (t === 'Teklif Ver') { await I(() => document.querySelectorAll('.meclis-full details').forEach((d) => (d.open = true))); await I(() => { const s = [...document.querySelectorAll('.meclis-full select')].filter((x) => [...x.options].some((o) => o.value === 'genelge')).at(-1); if (s) { s.value = 'genelge'; s.dispatchEvent(new Event('change')); } }); await sleep(300); log('genelge picker', (await I(() => [...document.querySelectorAll('.meclis-full select')].filter((x) => x.offsetParent).map((x) => x.options[x.selectedIndex]?.text).join(' | '))).slice(0, 200)); await p.screenshot({ path: `${OUT}/meclis-genelge.png` }); log('teklif btn', await I(() => [...document.querySelectorAll('.meclis-full button')].find((b) => b.textContent.includes('Teklif et'))?.textContent)); } }
log('meclis header', (await I(() => document.querySelector('.meclis-full .card')?.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 260));
log('meclis scroll', JSON.stringify(await I(() => { const s = document.querySelector('.sheet'); return { sh: s.scrollHeight, ch: s.clientHeight, ov: getComputedStyle(s).overflowY }; })));
await I(() => document.querySelector('.sheet .close')?.click()); await sleep(300);
// person sheet with campaign buttons
const near = await I((id) => { const S = window.__imp(); const m = S.placed.find((q) => q[0] === id); return S.placed.filter((q) => q[3] && q[0] !== id).sort((a, b) => Math.hypot(a[1] - m[1], a[2] - m[2]) - Math.hypot(b[1] - m[1], b[2] - m[2]))[0]; }, me0.id);
await I((q) => window.__imp().openP(q[0]), near); await sleep(1500);
log('person sheet buttons', (await I(() => [...document.querySelectorAll('.sheet button')].map((b) => b.textContent.trim()).filter(Boolean).join(' · '))).slice(0, 400)); await check('person');
await p.screenshot({ path: `${OUT}/person-campaign.png` });
await I(() => document.querySelector('.sheet .close')?.click()); await sleep(300);
// Göstergesi
await I(() => window.__imp().gosterge()); await sleep(700);
log('gosterge', (await I(() => document.querySelector('.gosterge-modal')?.innerText ?? 'yok')).replace(/\s+/g, ' ').slice(0, 200)); await check('gosterge'); await p.screenshot({ path: `${OUT}/gosterge.png` });
await I(() => document.querySelector('.gosterge-modal')?.remove()); await T.dismiss();
// O1: a family with children of 1, 8 and 13 years in front of their home next to an adult
const home = await T.W(`const c0 = w.children[0]; const par = w.people.find((x) => x.id === c0.parents[0]); w.hour = 10;
  for (const [i, y] of [[1, 1], [2, 8], [3, 13]]) w.children.push({ ...c0, id: 'ck' + i, name: 'Çocuk ' + y, born: w.day - y * 5 - 1, inSchool: false });
  const b = w.buildings.find((x) => x.id === (par.home ?? 'ev1')); return [b.door.x, b.door.y];`);
await sleep(3000); await I((xy) => window.__imp().look(xy[0], xy[1]), home); await sleep(1200); await p.screenshot({ path: `${OUT}/family.png` }); log('family at', JSON.stringify(home));
log('ISSUES', issues.length ? issues.join('\n') : 'none'); log('errors', JSON.stringify(T.errors.slice(0, 8))); await T.b.close();
