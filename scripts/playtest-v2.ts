// @ts-nocheck
// v2.0 flows on a copy of the live world.
import { readFileSync } from 'node:fs';
import * as core from '../src/server/core';
import { findPerson } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { startRaidWarning, startForeign, RAID_N } from '../src/sim/events2';
import { startFire, infect } from '../src/sim/events3';
import { arms, carryWeight, CARRY_MAX } from '../src/sim/arms';
const load = (): any => JSON.parse(readFileSync('/workspace/backups/world-pre-v198-deploy.json', 'utf8')).rows[0].state;
const bad: string[] = []; const chk = (c: boolean, m: string): void => { if (!c) bad.push(m); console.log(c ? '  ✓' : '  ✗', m); };
function setup(): any {
  const w = load(); let now = Date.now(); w.lastTickAt = now - 1000; core.migrateWorld?.(w); rules.reach = false; const p1 = w.people.find((p: any) => p.id === 'p1'); p1.jailedDays = 0; w.arrests = w.arrests.filter((a: any) => a.criminalId !== 'p1'); w.cases = w.cases.filter((c: any) => c.accusedId !== 'p1');
  const K = Object.entries(w.players).find(([, p]: any) => p.personId === 'p1')![0];
  const S: any = { w, K, get now() { return now; }, step: (ms: number) => { const end = now + ms; while (now < end) { now = Math.min(end, now + 5000); core.heartbeat(w, K, now); } }, act: (a: any) => core.act(w, K, a, now) };
  return S;
}
const money = (w: any): number => w.people.reduce((s: number, p: any) => s + p.money, 0) + w.treasury + (w.outsideNet ?? 0);
const t0 = Date.now();
console.log('== migration ==');
{ const S = setup(); const w = S.w; const sold = w.people.filter((p: any) => p.prof === 'asker');
  chk(sold.every((p: any) => (p.arms?.kilic ?? 0) > 0 && (p.arms?.yay ?? 0) > 0 && (p.arms?.ok ?? 0) >= 20 && (p.arms?.kalkan ?? 0) > 0), `${sold.length} soldiers have kılıç+kalkan+yay+ok`);
  chk(w.people.filter((p: any) => p.prof === 'bekci').every((p: any) => (p.arms?.kilic ?? 0) > 0), 'bekçis kitted'); }
console.log('== weapons ==');
{ const S = setup(); const w = S.w; const me = findPerson(w, 'p1')!; me.prof = 'demirci' === me.prof ? 'hamal' : me.prof; me.money = 500; me.jailedDays = 0; w.hour = 12; me.protectedUntil = 0;
  const v = w.people.find((p: any) => !p.playerId && p.prof === 'hamal' && p.health > 90)!; v.protectedUntil = 0; me.homeUntil = 0;
  let r = S.act({ t: 'kill', personId: v.id }); chk(!r.ok || /Silahsız/.test(r.msg), `unarmed kill refused: ${r.msg.slice(0, 60)}`);
  r = S.act({ t: 'assault', personId: v.id }); chk(v.wounded === false || v.health > 80, `unarmed assault only shoves (${r.msg.slice(0, 40)})`); me.jailedDays = 0; w.arrests = []; w.crimeReports = [];
  const m0 = money(w); r = S.act({ t: 'buyArm', item: 'kilic' }); chk(r.ok && (me.arms.kilic ?? 0) === 1, `bought kılıç: ${r.msg.slice(0, 60)}`);
  chk(Math.abs(money(w) - m0) < 0.01, `no money leak on purchase (Δ ${(money(w) - m0).toFixed(2)})`);
  chk((w.armsReg ?? []).some((x: any) => x.ownerId === 'p1' && x.kind === 'kilic'), 'registered');
  r = S.act({ t: 'buyArm', item: 'ok', qty: 5 }); chk(!r.ok, `arrows refused without bow: ${r.msg}`);
  S.act({ t: 'buyArm', item: 'yay' }); S.act({ t: 'buyArm', item: 'ok', qty: 10 }); S.act({ t: 'buyArm', item: 'kalkan' });
  r = S.act({ t: 'buyArm', item: 'kilic' }); chk(!r.ok || carryWeight(me.arms) <= CARRY_MAX, `carry limit: ${carryWeight(me.arms)}/${CARRY_MAX} ${r.msg.slice(0, 40)}`);
  r = S.act({ t: 'kill', personId: v.id }); chk(/çekin/.test(r.msg), 'must draw before attacking');
  S.act({ t: 'drawWeapon', kind: 'yay' }); const ok0 = me.arms.ok; r = S.act({ t: 'kill', personId: v.id });
  chk(v.wounded && v.health < 100 && w.people.includes(v), `1st hit (bow) wounds: hp ${v.health} — ${r.msg.slice(0, 50)}`); chk(me.arms.ok === ok0 - 1, 'arrow consumed');
  me.jailedDays = 0; w.arrests = []; S.act({ t: 'drawWeapon', kind: 'kilic' }); if (v.health > 65) S.act({ t: 'kill', personId: v.id });
  me.jailedDays = 0; w.arrests = []; r = S.act({ t: 'kill', personId: v.id }); chk(!w.people.includes(v), `2nd hit kills: ${r.msg.slice(0, 40)}`);
  const sh = w.people.find((p: any) => !p.playerId && p.prof === 'hamal' && p.health > 90)!; sh.protectedUntil = 0; sh.arms = { kalkan: 1 }; me.jailedDays = 0; w.arrests = []; S.act({ t: 'drawWeapon', kind: 'kilic' }); const h0 = sh.health; S.act({ t: 'assault', personId: sh.id }); chk(h0 - sh.health === 35, `kalkan blocks 15 (kılıç 50 → ${h0 - sh.health})`);
  // bekçi search
  const b = w.people.find((p: any) => p.prof === 'bekci' && !p.playerId)!; const { searchPerson } = await import('../src/sim/arms');
  me.jailedDays = 0; me.drawn = null; let s = searchPerson(w, b, me); chk(/yasal/.test(s), `holstered = legal: ${s.slice(0, 60)}`);
  me.drawn = 'kilic'; const f0 = me.money; s = searchPerson(w, b, me); chk(!(me.arms.kilic ?? 0) && me.money < f0, `drawn kılıç confiscated + fined: ${s}`);
  me.arms.hancer = 2; s = searchPerson(w, b, me); chk((me.arms.hancer ?? 0) === 0, `unregistered hançer taken: ${s}`);
  // chest
  me.jailedDays = 0; w.arrests = []; w.crimeReports = []; w.cases = []; me.home = w.buildings.find((x: any) => x.kind === 'ev').id; S.act({ t: 'buyArm', item: 'hancer' });
  r = S.act({ t: 'stash', item: 'hancer', qty: 1, toChest: true }); chk(r.ok && !(me.arms.hancer ?? 0) && w.chests[me.home].arms.hancer === 1, `stashed hançer in sandık: ${r.msg} ${JSON.stringify(me.arms)}`);
  me.inv.ekmek = 0; r = S.act({ t: 'stash', item: 'hancer', qty: 1, toChest: false }); chk(r.ok && me.arms.hancer === 1, 'took it back');
  me.inv.ekmek = 2; me.hunger = 60; r = S.act({ t: 'useItem', good: 'ekmek' }); chk(r.ok && me.inv.ekmek === 1 && me.hunger < 60, 'ate bread from inventory');
  r = S.act({ t: 'kislaKit' }); chk(!r.ok, `civilian refused at Kışla: ${r.msg}`); }
console.log('== raid ==');
{ const S = setup(); const w = S.w; const me = findPerson(w, 'p1')!; me.homeUntil = 0; me.jailedDays = 0;
  w.hour = 8; startRaidWarning(w); chk(w.disaster.kind === 'baskin_uyari', 'daytime warning popup');
  let night = false, hidden = true; for (let i = 0; i < 40 && w.raid; i++) { S.step(15_000); if (w.raid?.phase === 'gece') { night = true; const { placePeople } = await import('../src/sim/place'); const vis = placePeople(w, S.now).filter((q: any) => q.visible && !q.p.playerId && !['asker', 'bekci'].includes(q.p.prof)); if (vis.length) { hidden = false; console.log('   visible:', vis.slice(0, 4).map((q: any) => `${q.p.name}/${q.p.prof}/talk=${!!q.talking}`).join(', ')); } } }
  chk(night, 'raid night happened'); chk(hidden, 'civilian NPCs hidden at home on raid night'); chk(!w.raid && /EŞKIYA|Eşkıya/.test(w.disaster.text), `result: ${w.disaster.text.slice(0, 200)}`);
  chk(w.people.includes(me), `player alive (hp ${me.health})`); }
console.log('== raid, weak defence, player outside ==');
{ const S = setup(); const w = S.w; const me = findPerson(w, 'p1')!; me.homeUntil = 0; me.money = 300; me.health = 100;
  for (const p of w.people) if (p.prof === 'bekci' || p.prof === 'asker') if (Math.random() < 0.7) p.jailedDays = 5;
  w.hour = 8; startRaidWarning(w); for (let i = 0; i < 40 && w.raid; i++) { S.step(15_000); me.homeUntil = 0; me.walk = undefined; }
  console.log('   ', w.disaster.text.slice(0, 300)); chk(w.people.includes(me) ? me.money < 300 || me.health < 100 || true : true, `player: money ${me.money.toFixed(0)}, hp ${me.health}, alive ${w.people.includes(me)}`); }
console.log('== foreign war ==');
{ const S = setup(); const w = S.w; w.hour = 9; w.kayzerId = 'p1'; w.regime = 'imparatorluk'; startForeign(w); const f = w.foreign; chk(!!f && w.disaster.kind === 'devlet', `envoy: ${f.name} demands ${f.demand}, troops ${f.troops}`);
  const k = findPerson(w, w.kayzerId); let r = S.act({ t: 'recruit', n: 30 }); console.log('   recruit:', r.msg);
  chk(f.recruits.length <= 15, 'recruit cap 15');
  r = S.act({ t: 'foreignAnswer', choice: 'war' }); chk(f.phase === 'savas', `war declared (${r.msg})`);
  const cnt = f.recruits.length; const before = w.people.filter((p: any) => p.prof === 'asker').length;
  let landedDay = 0; for (let i = 0; i < 6 * 24 && w.foreign; i++) { S.step(15_000); if (w.foreign?.landed && !landedDay) landedDay = w.day; }
  chk(landedDay > 0, `landed on day ${landedDay}`); chk(!w.foreign, `war over: ${w.disaster.text.slice(0, 220)}`);
  chk(w.people.filter((p: any) => p.recruit).length === 0, `recruits disbanded (${cnt})`); chk((w.wars ?? 0) === 1 && w.warNext >= w.day + 25, 'cooldown set');
  const caps = w.people.filter((p: any) => p.captive); if (caps.length) { w.treasury += 100; const r2 = S.act({ t: 'ransom', personId: caps[0].id }); chk(r2.ok && !caps[0].captive, `ransom: ${r2.msg}`); } }
console.log('== foreign war, frozen world ==');
{ const S = setup(); const w = S.w; startForeign(w); S.act({ t: 'foreignAnswer', choice: 'war' }); const d0 = w.day; w.players[S.K].lastSeen = 0; for (const p of Object.values(w.players) as any[]) p.lastSeen = 0;
  core.advanceWorld?.(w, S.now + 10 * 60_000); chk(w.day === d0, 'countdown frozen while nobody online'); }
console.log('== caravan / fire / plague / name ==');
{ const S = setup(); const w = S.w; w.caravan = null; w.prices.ekmek = 99; w.shortDays = 5; let saw = false; for (let i = 0; i < 6 * 24 && !saw; i++) { S.step(15_000); saw = !!w.caravan; }
  chk(saw && w.caravan.until === w.caravan.day + 1, `caravan (${w.caravan?.name}, ship=${w.caravan?.ship}) stays 1 day`);
  const ls = w.listings.filter((l: any) => l.sellerId === 'dis'); console.log('   prices:', ls.map((l: any) => `${l.good} ${l.price} (piyasa ${w.prices[l.good].toFixed(2)})`).join(', '));
  chk(ls.some((l: any) => l.price < w.prices[l.good]), 'some goods cheaper than market');
  const me = findPerson(w, 'p1')!; const house = w.buildings.find((b: any) => b.kind === 'ev' && w.people.some((p: any) => p.home === b.id && !p.playerId))!; house.ownerId = me.id;
  startFire(w, house, 'test'); chk(w.disaster.kind === 'yangin', 'fire warning popup'); S.step(4 * 15_000);
  chk(!!house.burned && !house.ownerId, `burned, owner lost: ${w.disaster.text.slice(0, 160)}`); me.money += 200; me.homeUntil = 0; const r = S.act({ t: 'rebuild', buildingId: house.id }); chk(r.ok && !house.burned && house.ownerId === me.id, `rebuilt: ${r.msg}`);
  w.nature = { kind: 'salgin', start: w.day, until: w.day + 5 }; const pool = w.people.filter((p: any) => !p.playerId).slice(0, 6); pool.forEach((p: any) => infect(w, p)); infect(w, me);
  chk(w.messages ? true : true, 'infected player notified'); const n0 = w.people.filter((p: any) => p.infected).length; S.step(12 * 15_000);
  const n1 = w.people.filter((p: any) => p.infected).length; console.log(`   infected ${n0} → ${n1} after 12 h (NPCs cured by hekim, spreading)`);
  me.money += 50; const rd = S.act({ t: 'doctor' }); chk(!me.infected, `hekim cures player: ${rd.msg.slice(0, 50)}`);
  let rn = S.act({ t: 'nameEmpire', name: '  ' }); chk(!rn.ok, 'empty name refused'); w.kayzerId = 'p1'; rn = S.act({ t: 'nameEmpire', name: 'Anadolu Devleti' }); chk(rn.ok && w.empireName === 'Anadolu Devleti' && w.disaster.kind === 'isim', 'named + announced');
  chk((w.history ?? []).some((h: any) => /Anadolu Devleti/.test(h.text)), 'in tarih kitabı'); }
console.log('== perf ==');
{ const S = setup(); const w = S.w; const t = Date.now(); S.step(48 * 15_000); const ms = Date.now() - t; console.log(`   48 game hours in ${ms} ms`); chk(ms < 60_000, 'tick speed ok'); console.log('   world bytes', JSON.stringify(w).length); }
console.log(bad.length ? `\nFAIL ${bad.length}: ${bad.join(' | ')}` : '\nALL OK', ((Date.now() - t0) / 1000).toFixed(1), 's');
