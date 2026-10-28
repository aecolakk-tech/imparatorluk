// Full-system logic play-test on a copy of the live world (no network). Run: npx tsx scripts/playtest-all.ts
import { readFileSync } from 'node:fs';
import { applyAction, advanceWorld, findPerson, touchPlayer, totalMoney, joinWorld, hourMs } from '../src/sim/index';
import { migrateWorld } from '../src/sim/extras';
import { rules } from '../src/sim/move';
import { placePeople } from '../src/sim/place';
import { handleOrder, parseIntent } from '../src/sim/orders';
const w: any = JSON.parse(readFileSync(process.argv[2] ?? '/workspace/backups/world-pre-v193.json', 'utf8')).rows[0].state; migrateWorld(w);
rules.reach = false; let now = w.lastTickAt + 1000; w.serverNow = now;
const out: string[] = []; const bad: string[] = [];
const kp = Object.entries(w.players).find(([, p]: any) => p.personId === w.kayzerId)?.[0] as string;
joinWorld(w, 'tester', 'Deneme Oyuncu', 'hamal', false, now); touchPlayer(w, 'tester', now); touchPlayer(w, kp, now);
const K = findPerson(w, w.kayzerId)!; const U = findPerson(w, w.players.tester.personId)!; U.money = 3000; U.protectedUntil = 0;
const npc = w.people.find((p: any) => !p.playerId && p.prof === 'hamal' && p.jailedDays === 0)!;
const run = (who: string, a: any, expectOk?: boolean): any => { let r: any; try { r = applyAction(w, who, a, now); } catch (e: any) { bad.push(`THROW ${a.t}: ${e.message}`); return { ok: false, msg: 'throw' }; } out.push(`${who === kp ? 'K' : 'U'} ${a.t}: ${r.ok ? 'OK' : 'NO'} ${r.msg?.slice(0, 90)}`); if (expectOk !== undefined && r.ok !== expectOk) bad.push(`${a.t} expected ${expectOk ? 'ok' : 'refusal'}: ${r.msg}`); if (!/^[\s\S]*$/.test(r.msg ?? '') || /undefined|NaN|\[object/.test(r.msg ?? '')) bad.push(`bad text ${a.t}: ${r.msg}`); return r; };
const m0 = totalMoney(w);
// economy / market / jobs
run('tester', { t: 'buy', good: 'ekmek', qty: 2 }, true); run('tester', { t: 'eat' }); run('tester', { t: 'drinkWater' }); run('tester', { t: 'sell', good: 'ekmek', qty: 1, price: 2 });
run('tester', { t: 'work' }); run('tester', { t: 'borrow', amount: 50 }); const loan = w.loans.find((l: any) => l.personId === U.id || l.borrowerId === U.id); if (loan) run('tester', { t: 'repay', loanId: loan.id });
run('tester', { t: 'pray' }); run('tester', { t: 'drink' }); run('tester', { t: 'doctor' }); run('tester', { t: 'askida', qty: 1 });
// houses
const freeHouse = w.buildings.find((b: any) => b.kind === 'ev' && w.people.filter((p: any) => p.home === b.id).length < 5);
run('tester', { t: 'rentHome', houseId: freeHouse.id }, true); run('tester', { t: 'goHome', sleep: false }, true); if (!((U.homeUntil ?? 0) > now)) bad.push('goHome did not put me inside');
run('tester', { t: 'leaveHome' }, true); run('tester', { t: 'goHome', sleep: true }, true); run('tester', { t: 'leaveHome' }, true);
run('tester', { t: 'buyHome', houseId: freeHouse.id }); // already living there: refusal ok
// animals
run('tester', { t: 'buyFarm' }, true); run('tester', { t: 'buildBarn', kind: 'ahir' }, true); run('tester', { t: 'buildBarn', kind: 'kumes' }, true);
run('tester', { t: 'buyAnimal', animal: 'at' }, true); run('tester', { t: 'buyAnimal', animal: 'koyun' }, true); run('tester', { t: 'buyAnimal', animal: 'tavuk' }, true);
run('tester', { t: 'ride', on: true }, true); run('tester', { t: 'ride', on: false }, true); run('tester', { t: 'feedAnimals' }); run('tester', { t: 'slaughter', animal: 'koyun' }, true); run('tester', { t: 'slaughter', animal: 'at' }, false);
// meclis / election
run('tester', { t: 'runForMeclis' }); run('tester', { t: 'poster' }); run('tester', { t: 'campaign', text: 'Ekmek ucuz olsun' });
const cand = w.election.candidates[0]; if (cand) run('tester', { t: 'vote', candidateId: cand });
// cemiyet
run('tester', { t: 'orgFound', kind: 'cumhuriyet', name: 'Test Cemiyeti' }); run('tester', { t: 'orgMeet' }); run('tester', { t: 'orgLeave' });
// crime & trials
run('tester', { t: 'insult', personId: npc.id }); run('tester', { t: 'steal', personId: npc.id }); run('tester', { t: 'assault', personId: npc.id });
// Kayzer screens
run(kp, { t: 'setTax', rate: 0.1 }); run(kp, { t: 'setHeadTax', amount: 1 }); run(kp, { t: 'toggleLaw', lawId: (w.laws?.[0]?.id ?? 'x'), active: false }); run(kp, { t: 'festival', cost: 50 }); run(kp, { t: 'granary', op: 'buy', qty: 10 });
run(kp, { t: 'priceCap', good: 'ekmek', price: null }); run(kp, { t: 'directive', topic: 'namaz' }); run(kp, { t: 'setSpeed', speed: 1 }, true);
run(kp, { t: 'grantTitle', personId: npc.id, rank: 'Ağa' as any }); run(kp, { t: 'stripTitle', personId: npc.id });
run(kp, { t: 'missionCreate', text: 'Pazara un getir', reward: 5, to: null });
// chat orders
const asker = w.people.find((p: any) => p.prof === 'asker' && p.jailedDays === 0);
try { const r: any = handleOrder(w, K, asker, parseIntent(w, asker, K, 'kışlaya git') as any, 'kışlaya git', now); out.push('order -> ' + JSON.stringify(r).slice(0, 120)); } catch (e: any) { bad.push('order throw ' + e.message); }
// time: 6 game days with both players online; hunger/thirst/seasons/elections tick
const hm = hourMs(w); const d0 = w.day; let maxPos = 0;
for (let i = 0; i < 24 * 6; i++) { now += hm; w.serverNow = now; touchPlayer(w, 'tester', now); touchPlayer(w, kp, now); try { advanceWorld(w, now); } catch (e: any) { bad.push('advance throw ' + e.message); break; }
  if (i % 7 === 0) { const t0 = performance.now(); const pl = placePeople(w, now); maxPos = Math.max(maxPos, performance.now() - t0); for (const q of pl) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) { bad.push(`NaN position ${q.p.name}`); break; } } }
for (const p of w.people) { for (const k of ['money', 'health', 'mood', 'hunger', 'thirst']) if (!Number.isFinite(p[k] ?? 0)) bad.push(`${p.name}.${k} = ${p[k]}`); if (p.money < -0.01) bad.push(`${p.name} money ${p.money}`); }
console.log(out.join('\n'));
console.log(`\ndays ${d0} -> ${w.day}, pop ${w.people.length}, treasury ${Math.round(w.treasury)}, money drift ${(totalMoney(w) - m0).toFixed(2)} (outside trade allowed), seats filled ${w.meclis.seats.filter((s: any) => s.holder).length}, election next ${w.election.nextDay}, cases ${w.cases.length}, corpses ${(w.corpses ?? []).length}, placePeople max ${maxPos.toFixed(1)} ms`);
console.log('tester hunger/thirst', Math.round(U.hunger), Math.round(U.thirst), 'animals', JSON.stringify(U.animals), 'inv et', U.inv.et);
console.log('\nPROBLEMS:', bad.length ? bad.join('\n') : 'none');
