import { skillMul } from './career';
/**
 * v2.0.1 real-time combat for the eşkıya night and the foreign landing.
 * Foes are real entities with positions (walk paths), hit points and targets. The server advances the fight in
 * 1-second steps on every request (only while someone is online); players attack them with the weapon in hand.
 */
import type { Person, World } from './types';
import { findPath, rules, type Pt } from './move';
import { placePeople } from './place';
import { findPerson } from './world';
import { clamp, rand } from './rng';
import { transfer } from './economy';
import { personal } from './log';
import { die } from './family';
import { arms, bestWeapon, isUniformed, weaponInHand, ARM_DMG, ARM_LABEL, SHIELD_BLOCK } from './arms';
import { hourMs } from './tick';
import { fightMul, robShare } from './profile';
import { foePos, liveFoes, LIMAN_DOCK, SAIL_MS, type Combat, type Foe, type Hit } from './combatpos';

export const STEP_MS = 1000; const MAX_STEPS = 40;
export const RAID_MAX_MS = 6 * 60_000; export const WAR_MAX_MS = 9 * 60_000;
const FOE_HP = { eskiya: 100, macar: 100 } as const;
const FOE_SPEED = { eskiya: 2.3, macar: 1.7 } as const;
const MELEE = 1.6; const BOW_RANGE = 7;
// eşkıya walk in from beyond the map edge along the roads (outside point → edge → town)
const ENTRY: [Pt, Pt][] = [[{ x: -4, y: 13.5 }, { x: 1.5, y: 13.5 }], [{ x: 104, y: 20.5 }, { x: 98, y: 20.5 }], [{ x: -4, y: 29.5 }, { x: 1.5, y: 29.5 }], [{ x: 104, y: 35.5 }, { x: 98, y: 35.5 }], [{ x: 6.5, y: -4 }, { x: 6.5, y: 1.5 }], [{ x: 92.5, y: -4 }, { x: 92.5, y: 1.5 }], [{ x: -4, y: 20.5 }, { x: 1.5, y: 20.5 }], [{ x: 104, y: 13.5 }, { x: 98, y: 13.5 }]];
const MEYDAN: Pt = { x: 36, y: 30 };

export const fighter = (p: Person): boolean => isUniformed(p) && p.jailedDays === 0 && p.exiledDays === 0 && !p.captive && !(p.wounded && p.health <= 20) && p.health > 20;
const stand = (pt: Pt, t: number): Foe['walk'] => ({ path: [{ x: pt.x, y: pt.y }], t0: t, speed: 1 });

/** v2.0.1: during a raid/landing the clock slows to 0.25x; the Kayzer's speed comes back afterwards. Clock stays continuous. */
export const COMBAT_SPEED = 0.25;
export function setSpeedKeep(w: World, s: number, now: number): void { const f = Math.min(0.999, Math.max(0, (now - w.lastTickAt) / hourMs(w))); w.speed = s; w.lastTickAt = now - f * hourMs(w); }
export function slowForCombat(w: World, now: number): void { if (w.speedBefore === undefined || w.speedBefore === null) w.speedBefore = w.speed === COMBAT_SPEED ? 1 : w.speed; setSpeedKeep(w, COMBAT_SPEED, now); }
export function restoreSpeed(w: World, now: number): void { const s = w.speedBefore ?? 1; w.speedBefore = null; setSpeedKeep(w, s, now); }
function newCombat(kind: Combat['kind'], now: number, spawnAt: number): Combat { return { kind, startAt: now, at: now, spawnAt, foes: [], hits: [], assign: {} }; }
/** Raid night begins: 10 eşkıya come in from the town's edges. */
export function startRaidCombat(w: World, now: number, n: number, hp?: number[]): void {
  const c = newCombat('raid', now, now); w.combat = c; c.spawned = true; slowForCombat(w, now);
  for (let i = 0; i < n; i++) {
    const [out, edge] = ENTRY[i % ENTRY.length]!; const t0 = now + Math.floor(i / 2) * 4000; // they arrive in pairs, a few seconds apart
    const o = { x: out.x + (i % 2) * 0.6, y: out.y + (i % 2) * 0.5 }; const inner = { x: edge.x + (edge.x < 50 ? 8 : edge.x > 50 && edge.y > 5 ? -8 : 0), y: edge.y + (edge.y < 5 ? 8 : 0) };
    c.foes.push({ id: `E${now % 100000}-${i}`, kind: 'eskiya', hp: hp?.[i] ?? FOE_HP.eskiya, max: FOE_HP.eskiya, bow: i % 3 === 0, walk: { path: [o, edge, inner], t0, speed: FOE_SPEED.eskiya }, pathAt: t0 + 6000 });
  }
}
/** Foreign landing: ships sail in for SAIL_MS, then the troops come ashore at the Liman. */
export function startWarCombat(w: World, now: number, troops: number): void { const c = newCombat('war', now, now + SAIL_MS); c.foes = []; w.combat = c; slowForCombat(w, now); (c as Combat & { troops?: number }).troops = troops; }

function hit(c: Combat, h: Hit): void { c.hits.push(h); if (c.hits.length > 60) c.hits.splice(0, c.hits.length - 60); }

function assignFighters(w: World, c: Combat, placed: Map<string, { x: number; y: number }>, t: number): void {
  const live = c.foes.filter((f) => { if (f.hp <= 0 || t < f.walk.t0) return false; const p = foePos(f, t); return p.x >= 0 && p.x <= 100 && p.y >= 0; }); if (!live.length) return;
  const fighters = w.people.filter((p) => fighter(p) && (!p.playerId || p.npc) && (c.kind === 'war' || p.prof === 'bekci' || (p.id.charCodeAt(p.id.length - 1) % 3 !== 0)));
  const load = new Map<string, number>(); for (const a of Object.values(c.assign)) load.set(a.foe, (load.get(a.foe) ?? 0) + 1);
  for (const p of fighters) {
    const a = c.assign[p.id]; if (a && live.some((f) => f.id === a.foe)) continue;
    const from = placed.get(p.id); if (!from) continue;
    const foe = [...live].sort((x, y) => (load.get(x.id) ?? 0) - (load.get(y.id) ?? 0) || Math.hypot(foePos(x, t).x - from.x, foePos(x, t).y - from.y) - Math.hypot(foePos(y, t).x - from.x, foePos(y, t).y - from.y))[0]!;
    c.assign[p.id] = { foe: foe.id, at: t, fx: from.x, fy: from.y }; load.set(foe.id, (load.get(foe.id) ?? 0) + 1);
  }
  for (const id of Object.keys(c.assign)) { const p = findPerson(w, id); if (!p || !fighter(p)) delete c.assign[id]; }
}

/** Damage to a person (soldier, bekçi or player). NPC fighters retreat wounded at ≤20 and can fall; players never die here. */
function hurt(w: World, c: Combat, p: Person, dmg: number, by: string, wl: string, at: Pt, t: number): void {
  const shield = (arms(p).kalkan ?? 0) > 0; const d = Math.max(3, Math.round(dmg - (shield ? SHIELD_BLOCK * 0.6 : 0)));
  p.health = clamp(p.health - d); const player = !!p.playerId && !p.npc;
  if (player) { if (p.health < 5) p.health = 5; if (p.health <= 30) p.wounded = true; }
  hit(c, { at: t, x: at.x, y: at.y, dmg: d, to: p.id, toName: p.name, by, w: wl, k: shield ? 'block' : 'hit' });
  if (!player && p.health <= 20) {
    p.wounded = true; delete c.assign[p.id];
    if (p.health <= 6 && rand(w) < 0.5) { hit(c, { at: t, x: at.x, y: at.y, dmg: 0, to: p.id, toName: p.name, by, w: wl, k: 'down' }); (c as Combat & { fallen?: string[] }).fallen = [...((c as Combat & { fallen?: string[] }).fallen ?? []), p.name]; die(w, p, `${p.name} ${by} karşısında şehit düştü.`); }
    else (c as Combat & { hurt?: string[] }).hurt = [...((c as Combat & { hurt?: string[] }).hurt ?? []), p.name];
  }
}
function foeKilled(w: World, c: Combat, _f: Foe, by: Person | null): void {
  if (w.raid && c.kind === 'raid') w.raid.killed = (w.raid.killed ?? 0) + 1;
  if (w.foreign && c.kind === 'war') { w.foreign.killed = (w.foreign.killed ?? 0) + 1; w.foreign.alive = liveFoes(w).length; }
  if (by) { (c.fought ??= {})[by.id] = (c.fought[by.id] ?? 0) + 1; }
  if (by) { by.xp += 3; by.rep = clamp(by.rep + 2, -100, 100); if (by.playerId && !by.npc && transfer(w, 'saray', by.id, 5, c.kind === 'raid' ? 'eşkıya ödülü' : 'düşman askeri ödülü')) personal(w, by.playerId, `⚔ ${c.kind === 'raid' ? 'Bir eşkıyayı' : 'Bir düşman askerini'} yere serdiniz! Ödül: 5 D (hazineden).`); }
}

/** One player attack on a foe (the 'attack' action). */
export function attackFoe(w: World, me: Person, foeId: string, now: number): { ok: boolean; msg: string } {
  const c = w.combat; const f = c?.foes.find((x) => x.id === foeId && x.hp > 0); if (!c || !f) return { ok: false, msg: 'Hedef yok (ölmüş ya da gitmiş).' };
  if (me.jailedDays > 0) return { ok: false, msg: 'Zindandasınız.' };
  if (me.health <= 10) return { ok: false, msg: 'Çok ağır yaralısınız; savaşamazsınız. Hekime gidin.' };
  const wp = weaponInHand(me); if (!wp) return { ok: false, msg: bestWeapon(me) ? 'Önce silahınızı seçin (alttaki hızlı çubuk) – kınında silahla vurulmaz.' : 'Silahınız yok. Demirci’den (Zanaat Atölyesi) kılıç, hançer ya da yay alın.' };
  if (now - (me.atkAt ?? 0) < 1100) return { ok: false, msg: '' };
  const q = placePeople(w, now).find((x) => x.p.id === me.id); const fp = foePos(f, now);
  const d = q ? Math.hypot(q.x - fp.x, q.y - fp.y) : 0; const range = wp === 'yay' ? BOW_RANGE : MELEE;
  if (rules.reach && d > range + 0.3) return { ok: false, msg: wp === 'yay' ? `Menzil dışında (${d.toFixed(1)} kare; yay ${BOW_RANGE}).` : 'Çok uzak – yanına gidin (kılıç/hançer yakın dövüş).' };
  me.atkAt = now; (c.fought ??= {})[me.id] ??= 0;
  if (wp === 'yay') { const a = arms(me); a.ok = Math.max(0, (a.ok ?? 0) - 1); }
  const kind = f.kind === 'eskiya' ? 'eşkıya' : 'düşman askeri';
  if (rand(w) > (wp === 'yay' ? 0.7 : 0.85)) { hit(c, { at: now, x: fp.x, y: fp.y, dmg: 0, to: f.id, toName: kind, by: me.name, w: ARM_LABEL[wp], k: 'miss' }); return { ok: true, msg: 'Iska!' }; }
  const dmg = Math.round(ARM_DMG[wp] * fightMul(me, w) * skillMul(me) * (0.85 + rand(w) * 0.3)); f.hp = Math.max(0, f.hp - dmg);
  hit(c, { at: now, x: fp.x, y: fp.y, dmg, to: f.id, toName: kind, by: me.name, w: ARM_LABEL[wp], k: f.hp <= 0 ? 'kill' : 'hit' });
  if (f.hp <= 0) { foeKilled(w, c, f, me); return { ok: true, msg: `${kind[0]!.toUpperCase()}${kind.slice(1)} öldü!` }; }
  return { ok: true, msg: `${ARM_LABEL[wp]} ile vurdunuz (−${dmg}).` };
}

function retarget(w: World, f: Foe, from: Pt, to: Pt, t: number): void {
  const last = f.walk.path[f.walk.path.length - 1]!;
  if (f.pathAt && t - f.pathAt < 2500 && Math.hypot(last.x - to.x, last.y - to.y) < 2) return;
  f.walk = { path: findPath(w, from, to), t0: t, speed: FOE_SPEED[f.kind] }; f.pathAt = t;
}

function step(w: World, c: Combat, t: number, end: { raid?: boolean; war?: boolean | null }): void {
  // landing: troops come ashore when the ships dock
  if (c.kind === 'war' && !c.spawned && t >= c.spawnAt) {
    c.spawned = true; const n = (c as Combat & { troops?: number }).troops ?? w.foreign?.troops ?? 12;
    for (let i = 0; i < n; i++) c.foes.push({ id: `M${t % 100000}-${i}`, kind: 'macar', hp: FOE_HP.macar, max: FOE_HP.macar, bow: i % 3 === 0, walk: stand({ x: LIMAN_DOCK.x - 5 + (i % 10) * 1.1, y: LIMAN_DOCK.y - 0.4 - Math.floor(i / 10) * 0.8 }, t) });
    if (w.foreign) w.foreign.alive = n;
  }
  if (!c.spawned) return;
  const placedArr = placePeople(w, t); const placed = new Map(placedArr.map((q) => [q.p.id, q]));
  assignFighters(w, c, placed, t);
  const live = c.foes.filter((f) => f.hp > 0);
  // fighters who reached their foe strike
  for (const [id, a] of Object.entries(c.assign)) {
    const p = findPerson(w, id); const f = live.find((x) => x.id === a.foe); const q = placed.get(id); if (!p || !f || !q || f.hp <= 0) continue;
    const fp = foePos(f, t); if (Math.hypot(q.x - fp.x, q.y - fp.y) > MELEE + 0.2) continue;
    if (rand(w) > (c.kind === 'raid' ? 0.028 : 0.045)) continue;
    const wp = bestWeapon(p) ?? 'kilic'; const dmg = Math.round(ARM_DMG[wp] * 0.5 * (0.8 + rand(w) * 0.4)); f.hp = Math.max(0, f.hp - dmg);
    hit(c, { at: t, x: fp.x, y: fp.y, dmg, to: f.id, toName: f.kind === 'eskiya' ? 'eşkıya' : 'düşman', by: p.name, w: ARM_LABEL[wp], k: f.hp <= 0 ? 'kill' : 'hit' });
    if (f.hp <= 0) foeKilled(w, c, f, p);
  }
  // foes move and strike
  for (const f of c.foes) {
    if (f.hp <= 0) continue; const pos = foePos(f, t);
    if (pos.x < 0 || pos.x > 100 || pos.y < 0 || t < f.walk.t0) continue; // still outside the town
    const targets = placedArr.filter((q) => q.visible && q.p.jailedDays === 0 && q.p.prof !== 'naip' && ((c.assign[q.p.id]?.foe === f.id) || (q.p.playerId && !q.p.npc && (q.p.homeUntil ?? 0) <= t)) && Math.hypot(q.x - pos.x, q.y - pos.y) < (f.kind === 'eskiya' ? 12 : 9));
    targets.sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y));
    const tg = targets[0];
    const range = f.bow ? 5 : MELEE;
    if (tg && Math.hypot(tg.x - pos.x, tg.y - pos.y) <= range) {
      if (f.walk.path.length > 1) f.walk = stand(pos, t);
      if (rand(w) < (f.bow ? 0.08 : 0.1)) {
        const base = f.kind === 'eskiya' ? 13 : 14; const dmg = Math.round(base * (0.7 + rand(w) * 0.6));
        hurt(w, c, tg.p, dmg, f.kind === 'eskiya' ? 'Eşkıya' : `${w.foreign?.name ?? 'Düşman'} askeri`, f.bow ? 'ok' : 'kılıç', { x: tg.x, y: tg.y }, t);
        // eşkıya rob a beaten player once
        if (f.kind === 'eskiya' && tg.p.playerId && !tg.p.npc && tg.p.health <= 25 && !(f.robbed ?? []).includes(tg.p.id)) {
          f.robbed = [...(f.robbed ?? []), tg.p.id]; const take = Math.round(tg.p.money * robShare(tg.p) * 100) / 100;
          if (take > 0 && transfer(w, tg.p.id, 'dis', take, 'eşkıya soygunu') && w.raid) w.raid.stolen = (w.raid.stolen ?? 0) + take;
          hit(c, { at: t, x: tg.x, y: tg.y, dmg: take, to: tg.p.id, toName: tg.p.name, by: 'Eşkıya', w: 'soygun', k: 'rob' });
          personal(w, tg.p.playerId, `🗡 Eşkıya sizi yere serdi ve kesenizden ${take} D aldı! (Silahlarınız sizde kaldı.) Hekimhane’ye gidin ya da evinize kaçın.`);
          if (w.raid) w.raid.hurt = [...new Set([...(w.raid.hurt ?? []), tg.p.name])];
        }
      }
    } else if (tg) retarget(w, f, pos, { x: tg.x, y: tg.y }, t);
    else if (t >= (f.walk.t0 + 1000) && (f.walk.path.length <= 1 || !f.pathAt || t - f.pathAt > 9000)) {
      // nobody near: eşkıya prowl the streets, the landing force marches on the Pazar/Meydan
      const k = Math.floor(rand(w) * 1000);
      const dest = f.kind === 'macar' ? { x: MEYDAN.x - 4 + (k % 9), y: MEYDAN.y - 2 + (k % 5) } : { x: [6, 17, 29, 44, 56, 68, 80][k % 7]! + 0.5, y: [13, 20, 29, 35][k % 4]! + 0.5 };
      f.walk = { path: findPath(w, pos, dest), t0: t, speed: FOE_SPEED[f.kind] }; f.pathAt = t;
    }
  }
  const alive = c.foes.filter((f) => f.hp > 0).length;
  if (c.kind === 'raid') { if (!alive) end.raid = true; else if (t - c.startAt > RAID_MAX_MS) end.raid = false; }
  else { if (!alive) end.war = true; else if (!w.people.some(fighter) && !placedArr.some((q) => q.p.playerId && !q.p.npc && q.visible && weaponInHand(q.p))) end.war = false; else if (t - c.startAt > WAR_MAX_MS) end.war = true; }
}

/** Advance the fight to `now` (1 s steps; long gaps – nobody online – are skipped, not replayed). */
export function combatTick(w: World, now: number, onEnd: (kind: 'raid' | 'war', won: boolean) => void): void {
  const c = w.combat; if (!c) return;
  if (now - c.at > MAX_STEPS * STEP_MS) c.at = now - MAX_STEPS * STEP_MS;
  while (c.at + STEP_MS <= now) {
    c.at += STEP_MS; const end: { raid?: boolean; war?: boolean | null } = {};
    step(w, c, c.at, end);
    if (end.raid !== undefined) { onEnd('raid', end.raid); restoreSpeed(w, now); return; }
    if (end.war !== undefined && end.war !== null) { onEnd('war', end.war); restoreSpeed(w, now); return; }
  }
}
export { liveFoes };
