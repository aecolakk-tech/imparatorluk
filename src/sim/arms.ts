/**
 * v1.9.9: weapons, ammo, carried inventory and house chests (sandık).
 * - Weapons only come from the Demirci (fixed prices) or the Kışla (free kit for asker/bekçi); every piece is registered.
 * - To hurt someone you draw (kuşan) a weapon from your inventory. A drawn weapon in public is an offence for civilians:
 *   a bekçi nearby confiscates it and fines you. Holstered weapons are legal; stashed at home they are safe.
 * - Killing takes two hits: the first wounds, a second one on a wounded victim kills. A bow spends an arrow per shot.
 * - Carry limit by weight. On death carried weapons drop into the house chest (or are lost to the state).
 */
import type { Good, Person, World } from './types';
import { findPerson } from './world';
import { transfer } from './economy';
import { log, personal } from './log';
import { clamp } from './rng';

export type Weapon = 'hancer' | 'kilic' | 'yay';
export type ArmItem = Weapon | 'ok' | 'kalkan';
export const WEAPONS: Weapon[] = ['hancer', 'kilic', 'yay'];
export const ARM_LABEL: Record<ArmItem, string> = { hancer: 'Hançer', kilic: 'Kılıç', yay: 'Yay', ok: 'Ok', kalkan: 'Kalkan' };
export const ARM_PRICE: Record<ArmItem, number> = { hancer: 25, kilic: 60, yay: 45, ok: 1, kalkan: 30 };
export const ARM_WEIGHT: Record<ArmItem, number> = { hancer: 0.5, kilic: 3, yay: 1.5, ok: 0.05, kalkan: 3 };
export const ARM_DMG: Record<Weapon, number> = { hancer: 35, kilic: 50, yay: 30 }; // arrows hit weaker than a sword
export const SHIELD_BLOCK = 15; // a kalkan takes this much off every blow
export const CARRY_MAX = 10; // kg of weapons + ammo a person carries
export const ARM_FINE = 15;
export const MATERIAL_SHARE = 0.3; // part of a weapon's price that leaves the city (iron, powder) – a money sink
export const KILL_HP = 65; // a wounded victim at or below this health dies from the next hit

export type Arms = Partial<Record<ArmItem, number>>;
export const arms = (p: Person): Arms => (p.arms ??= {});
export const isUniformed = (p: Person): boolean => p.prof === 'asker' || p.prof === 'bekci';
export function carryWeight(a: Arms): number { return (Object.entries(a) as [ArmItem, number][]).reduce((s, [k, n]) => s + (ARM_WEIGHT[k] ?? 0) * (n ?? 0), 0); }
export function chestOf(w: World, p: Person): { goods: Partial<Record<Good, number>>; arms: Arms } | null {
  if (!p.home || !w.buildings.some((b) => b.id === p.home) || p.home === 'kisla' || p.home === 'saray' && p.id !== w.kayzerId) return null;
  return ((w.chests ??= {})[p.home] ??= { goods: {}, arms: {} });
}
function register(w: World, p: Person, kind: Weapon, by: 'demirci' | 'kisla'): void {
  w.armsReg = [...(w.armsReg ?? []), { ownerId: p.id, kind, day: w.day, by }].slice(-400);
}
export function registered(w: World, p: Person, kind: Weapon): number { return (w.armsReg ?? []).filter((r) => r.ownerId === p.id && r.kind === kind).length; }
function unregister(w: World, p: Person, kind: Weapon, n: number): void {
  for (let i = 0; i < n; i++) { const k = (w.armsReg ?? []).findIndex((r) => r.ownerId === p.id && r.kind === kind); if (k >= 0) w.armsReg!.splice(k, 1); }
}
/** Best usable weapon in hand: the drawn one (a bow needs arrows). NPC criminals draw automatically. */
export function weaponInHand(p: Person): Weapon | null {
  const a = arms(p); const d = p.drawn;
  if (d && (a[d] ?? 0) > 0 && (d !== 'yay' || (a.ok ?? 0) > 0)) return d;
  return null;
}
export function bestWeapon(p: Person): Weapon | null {
  const a = arms(p); if ((a.kilic ?? 0) > 0) return 'kilic'; if ((a.yay ?? 0) > 0 && (a.ok ?? 0) > 0) return 'yay'; if ((a.hancer ?? 0) > 0) return 'hancer'; return null;
}

export function buyArm(w: World, p: Person, item: ArmItem, qty = 1): string | null {
  const smith = w.people.find((x) => x.prof === 'demirci' && x.jailedDays === 0 && x.exiledDays === 0 && x.id !== p.id);
  if (!smith) return 'Şehirde çalışan demirci yok.';
  const n = item === 'ok' ? Math.max(1, Math.min(30, Math.floor(qty))) : 1;
  const a = arms(p); if (carryWeight(a) + ARM_WEIGHT[item] * n > CARRY_MAX) return `Çok ağır: en fazla ${CARRY_MAX} kg silah/ok taşıyabilirsiniz. Bir kısmını evdeki sandığa koyun.`;
  if (item === 'ok' && !(a.yay ?? 0) && !(chestOf(w, p)?.arms.yay ?? 0)) return 'Yayınız yok; ok satılmaz.';
  const price = ARM_PRICE[item] * n; if (p.money < price) return `Paranız yetmiyor (${price} D).`;
  transfer(w, p.id, smith.id, Math.round(price * (1 - MATERIAL_SHARE) * 100) / 100, `${ARM_LABEL[item]} (demirci)`);
  transfer(w, p.id, 'dis', Math.round(price * MATERIAL_SHARE * 100) / 100, 'demir/barut (dışarıdan)');
  smith.incomeToday += price * (1 - MATERIAL_SHARE);
  a[item] = (a[item] ?? 0) + n; if (item !== 'ok' && item !== 'kalkan') register(w, p, item, 'demirci');
  return null;
}
/** Free kit at the Kışla: asker and bekçi → kılıç + kalkan + yay + 20 ok. Once every 2 days. */
export function kislaKit(w: World, p: Person): string | null {
  if (!isUniformed(p)) return 'Kışla teçhizatı sadece asker ve bekçilere verilir.';
  if ((p.kitDay ?? -99) > w.day - 2) return 'Teçhizatınızı yakın zamanda aldınız (2 günde bir).';
  const a = arms(p); p.kitDay = w.day; const got: string[] = [];
  const give = (k: ArmItem, n: number): void => { if (carryWeight(a) + ARM_WEIGHT[k] * n > CARRY_MAX + 2) return; a[k] = (a[k] ?? 0) + n; if (k !== 'ok' && k !== 'kalkan') register(w, p, k, 'kisla'); got.push(`${n} ${ARM_LABEL[k]}`); };
  if (!(a.kilic ?? 0)) give('kilic', 1);
  if (!(a.kalkan ?? 0)) give('kalkan', 1); if (!(a.yay ?? 0)) give('yay', 1); if ((a.ok ?? 0) < 20) give('ok', 20 - (a.ok ?? 0));
  const cost = got.length * 5; transfer(w, 'saray', 'dis', Math.min(cost, w.treasury), 'kışla teçhizatı');
  return got.length ? null : 'Teçhizatınız tam.';
}
export function draw(p: Person, kind: Weapon | null): string | null {
  if (!kind) { p.drawn = null; return null; }
  if (!(arms(p)[kind] ?? 0)) return `Üzerinizde ${ARM_LABEL[kind].toLocaleLowerCase('tr')} yok.`;
  if (kind === 'yay' && !(arms(p).ok ?? 0)) return 'Okunuz yok.';
  p.drawn = kind; return null;
}
/** Move items between the person and the house chest. */
export function stash(w: World, p: Person, item: ArmItem | Good, qty: number, toChest: boolean): string | null {
  const ch = chestOf(w, p); if (!ch) return 'Sandık için bir eviniz olmalı.';
  const isArm = (item as string) in ARM_PRICE; const n = Math.max(1, Math.floor(qty));
  if (isArm) {
    const k = item as ArmItem; const from = toChest ? arms(p) : ch.arms; const to = toChest ? ch.arms : arms(p);
    if ((from[k] ?? 0) < n) return 'Yeterince yok.';
    if (!toChest && carryWeight(arms(p)) + ARM_WEIGHT[k] * n > CARRY_MAX) return `Çok ağır (en fazla ${CARRY_MAX} kg).`;
    from[k] = (from[k] ?? 0) - n; to[k] = (to[k] ?? 0) + n;
    if (toChest && p.drawn === k && !(arms(p)[k] ?? 0)) p.drawn = null;
  } else {
    const g = item as Good; if (toChest) { if ((p.inv[g] ?? 0) < n) return 'Yeterince yok.'; p.inv[g] -= n; ch.goods[g] = (ch.goods[g] ?? 0) + n; }
    else { if ((ch.goods[g] ?? 0) < n) return 'Sandıkta yok.'; ch.goods[g]! -= n; p.inv[g] = (p.inv[g] ?? 0) + n; }
  }
  return null;
}
/** One blow. Returns 'wound' | 'kill' | null (no weapon). Consumes an arrow for the bow. */
export function strike(_w: World, a: Person, v: Person): { res: 'wound' | 'kill'; weapon: Weapon } | null {
  const wp = weaponInHand(a); if (!wp) return null;
  if (wp === 'yay') { arms(a).ok = (arms(a).ok ?? 0) - 1; if (!(arms(a).ok ?? 0) && a.drawn === 'yay') a.drawn = bestWeapon(a) === 'yay' ? 'yay' : null; }
  if (v.wounded && v.health <= KILL_HP) return { res: 'kill', weapon: wp };
  v.health = clamp(v.health - Math.max(10, ARM_DMG[wp] - ((arms(v).kalkan ?? 0) > 0 ? SHIELD_BLOCK : 0))); v.wounded = true; if (v.health <= 0) { v.health = 1; }
  return { res: 'wound', weapon: wp };
}
/** NPC (or anyone without a drawn weapon) arms itself: draws the best weapon carried. */
export function autoDraw(p: Person): Weapon | null { const b = bestWeapon(p); if (b) p.drawn = b; return b; }

/** A civilian with a drawn weapon near a bekçi: confiscation + fine. Called hourly and by the 'search' action. */
export function searchPerson(w: World, bekci: Person, t: Person, now?: number): string {
  const a = arms(t); const out: string[] = [];
  if (isUniformed(t)) return `${t.name} görevli; silah taşıması serbest.`;
  for (const k of WEAPONS) {
    const n = a[k] ?? 0; if (!n) continue;
    const reg = registered(w, t, k); const illegal = Math.max(0, n - reg); const drawn = t.drawn === k;
    const take = drawn && !w.combat ? n : illegal; if (!take) continue; // v2.0.1: a drawn blade is legal while the town is under attack
    a[k] = n - take; unregister(w, t, k, Math.min(take, reg)); out.push(`${take} ${ARM_LABEL[k]}${drawn ? ' (çekili)' : ' (kayıtsız)'}`);
  }
  if (!out.length) return `${t.name} arandı: ${WEAPONS.some((k) => a[k]) ? 'kayıtlı ve kınında silahları var, yasal.' : 'silah yok.'}`;
  if (t.drawn && !(a[t.drawn] ?? 0)) t.drawn = null;
  if (!(a.yay ?? 0)) a.ok = 0;
  const fine = Math.min(ARM_FINE, Math.max(0, t.money)); if (fine > 0) transfer(w, t.id, 'saray', fine, 'silah cezası');
  t.armsFines = (t.armsFines ?? 0) + 1; t.rep = clamp(t.rep - 5, -100, 100);
  log(w, `🛡 Bekçi ${bekci.name}, ${t.name} üzerinde ${out.join(', ')} buldu; el koydu, ${fine} D ceza kesti.`, t.id, now);
  if (t.playerId && !t.npc) personal(w, t.playerId, `🛡 Bekçi ${bekci.name} sizi aradı: ${out.join(', ')} – el koydu${fine > 0 ? `, ${fine} D silah cezası kesti` : ''}. Sebep: ${out.some((x) => x.includes('çekili')) ? 'sokakta çekili silah taşımak yasak (kınına koyun)' : 'kayıtsız silah'}.`, now);
  if (t.playerId) personal(w, t.playerId, `🛡 Bekçi ${bekci.name} sizi aradı: ${out.join(', ')} el konuldu, ${fine} D ceza. Silahları evdeki sandıkta saklayın ya da kınında taşıyın.`, now);
  return `El konuldu: ${out.join(', ')}; ${fine} D ceza.`;
}
/** Drop on death: weapons go to the house chest (heirs), else to the state. */
export function dropArms(w: World, p: Person): void {
  const a = arms(p); const ch = chestOf(w, p);
  for (const [k, n] of Object.entries(a) as [ArmItem, number][]) { if (!n) continue; if (ch) ch.arms[k] = (ch.arms[k] ?? 0) + n; }
  p.arms = {}; p.drawn = null; w.armsReg = (w.armsReg ?? []).filter((r) => r.ownerId !== p.id || !!ch);
}
/** NPC habits once a game hour: uniformed people carry their kit; civilians keep weapons holstered by day and stash them at home at night. */
export function npcArmsHour(w: World): void {
  for (const p of w.people) {
    if (p.playerId && !p.npc) continue;
    if (isUniformed(p)) { if (!bestWeapon(p) && p.jailedDays === 0) kislaKit(w, p); continue; }
    const a = arms(p); if (!WEAPONS.some((k) => a[k])) continue;
    if (p.drawn) p.drawn = null; // NPCs never walk around with a drawn blade
    const ch = chestOf(w, p);
    if (ch && (w.hour >= 22 || w.hour < 6) && !p.nightOut) for (const k of [...WEAPONS, 'ok'] as ArmItem[]) { const n = a[k] ?? 0; if (n && k !== 'hancer') { ch.arms[k] = (ch.arms[k] ?? 0) + n; a[k] = 0; } }
    if (ch && w.hour === 7) for (const k of ['hancer'] as ArmItem[]) if (!(a[k] ?? 0) && (ch.arms[k] ?? 0) > 0) { ch.arms[k]! -= 1; a[k] = 1; }
  }
}
/** Hourly: bekçis on the street notice drawn weapons within 4 tiles. */
export function bekciPatrol(w: World, placed: { p: Person; x: number; y: number; visible: boolean }[], now: number): void {
  if (w.combat || w.raid?.phase === 'gece' || w.foreign?.landed) return; // v2.0.1: self-defence – no confiscation during a raid or war
  const bekcis = placed.filter((q) => q.visible && q.p.prof === 'bekci' && q.p.jailedDays === 0 && (!q.p.playerId || q.p.npc));
  if (!bekcis.length) return;
  for (const q of placed) {
    if (!q.visible || !q.p.drawn || isUniformed(q.p) || q.p.jailedDays > 0) continue;
    const b = bekcis.find((x) => Math.hypot(x.x - q.x, x.y - q.y) <= 4); if (b) searchPerson(w, b.p, q.p, now);
  }
}
/** Migration: soldiers/bekçis get their kit, alet stays a tool (no conversion). */
export function migrateArms(w: World): void {
  if (w.armsV) return; w.armsV = 1; w.chests ??= {}; w.armsReg ??= [];
  for (const p of w.people) { p.arms ??= {}; if (isUniformed(p)) { p.kitDay = -99; kislaKit(w, p); } }
}
export function armsLine(p: Person): string {
  const a = arms(p); const parts = (Object.entries(a) as [ArmItem, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${ARM_LABEL[k]}`);
  return parts.length ? `${parts.join(', ')}${p.drawn ? ` · çekili: ${ARM_LABEL[p.drawn]}` : ''} · ${carryWeight(a).toFixed(1)}/${CARRY_MAX} kg` : 'silah yok';
}
export { findPerson };
