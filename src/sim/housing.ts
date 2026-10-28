import { energyMul } from './profile';
import { oldHeal } from './age';
import { ek } from './tr';
/** v1.9 housing: 5 people per house, buy or rent a spot, go home and sleep, home = safe zone. */
import type { Person, World } from './types';
import { findPerson } from './world';
import { transfer } from './economy';
import { log, personal } from './log';
import { clamp } from './rng';

export const HOUSE_CAP = 5; export const SPOT_PRICE = 150; export const RENT_PER_DAY = 4;
export const houses = (w: World): World['buildings'] => w.buildings.filter((b) => b.kind === 'ev');
export const residents = (w: World, id: string): Person[] => w.people.filter((p) => p.home === id);
export const freeSpots = (w: World, id: string): number => HOUSE_CAP - residents(w, id).length;
export const ownerOf = (w: World, id: string): Person | undefined => { const b = w.buildings.find((x) => x.id === id); return findPerson(w, b?.ownerId) ?? residents(w, id)[0]; };
export const homeless = (p: Person): boolean => !p.home || p.home === 'sokak';
/** Inside the house (resting/sleeping): nobody outside can reach them. NPCs are indoors at night. */
export function atHomeSafe(w: World, p: Person, now = w.serverNow ?? w.lastTickAt): boolean {
  if (homeless(p) || p.jailedDays > 0) return false;
  if (p.playerId && !p.npc) return (p.homeUntil ?? 0) > now;
  return (w.hour >= 22 || w.hour < 5) && !p.nightOut && !['bekci', 'asker', 'naip'].includes(p.prof) && !p.task;
}
export function moveIn(w: World, p: Person, id: string, how: 'satin' | 'kira'): string {
  const b = w.buildings.find((x) => x.id === id && x.kind === 'ev'); if (!b) return 'Böyle bir ev yok.';
  if (p.home === id) return 'Zaten burada oturuyorsunuz.';
  if (freeSpots(w, id) <= 0) return `Bu ev dolu (${HOUSE_CAP}/${HOUSE_CAP}).`;
  const owner = ownerOf(w, id); const to = owner && owner.id !== p.id ? owner.id : 'saray';
  const cost = how === 'satin' ? SPOT_PRICE : RENT_PER_DAY;
  if (!transfer(w, p.id, to, cost, how === 'satin' ? 'ev payı' : 'kira')) return `${how === 'satin' ? 'Ev payı' : 'İlk günün kirası'} ${cost} Dinar; paranız yetmiyor.`;
  if (!b.ownerId && owner) b.ownerId = owner.id;
  p.home = id; p.renting = how === 'kira' ? id : null;
  const sp = findPerson(w, p.spouse); if (sp && sp.home !== id && freeSpots(w, id) > 0) sp.home = id; // couples live together
  if (owner?.playerId && owner.id !== p.id) personal(w, owner.playerId, `🏠 ${p.name} evinize ${how === 'satin' ? `${SPOT_PRICE} Dinar’a yer satın aldı` : `kiracı olarak taşındı (${RENT_PER_DAY} D/gün)`}.`);
  return how === 'satin' ? `${b.name}’de yer satın aldınız (${SPOT_PRICE} D, ${ek(owner?.name ?? 'Saray', 'a')}). Geceleri evinizde uyuyabilirsiniz.` : `${ek(b.name, 'a')} kiracı olarak taşındınız (${RENT_PER_DAY} D/gün, ${ek(owner?.name ?? 'Saray', 'a')}).`;
}
/** Daily rent; unpaid rent = eviction. */
export function housingDay(w: World): void {
  for (const p of w.people) {
    if (!p.renting || p.home !== p.renting) continue; const owner = ownerOf(w, p.home);
    if (!transfer(w, p.id, owner && owner.id !== p.id ? owner.id : 'saray', RENT_PER_DAY, 'kira')) { const h = p.home; p.home = ''; p.renting = null; p.homeUntil = 0; if (p.playerId) personal(w, p.playerId, `Kirayı ödeyemediniz; ${w.buildings.find((b) => b.id === h)?.name ?? 'ev'}den çıkarıldınız.`); }
  }
}
/** Rest inside (sleep = until morning). Restores energy and health; safe from crimes while inside. */
export function goInside(w: World, p: Person, sleep: boolean, now: number, hourMs: number): string {
  if (homeless(p)) return 'Eviniz yok. Boş yeri olan bir eve dokunup yer satın alın ya da kiralayın.';
  const hoursToMorning = ((7 - w.hour) + 24) % 24 || 8;
  const h = sleep ? Math.min(10, Math.max(2, hoursToMorning)) : 2;
  p.homeUntil = now + h * hourMs; p.sleeping = sleep; delete p.walk;
  return sleep ? `İyi geceler. ${h} saat uyuyacaksınız; enerji ve sağlık yenilenir. Evdeyken kimse size dokunamaz.` : 'Evinizdesiniz (2 saat dinlenme). Evdeyken kimse size dokunamaz.';
}
export function leaveHome(p: Person): void { p.homeUntil = 0; p.sleeping = false; }
/** Hourly: energy drains while awake, sleep/rest restores energy and health. */
export function energyHour(w: World, now: number): void {
  for (const p of w.people) {
    // v1.9.6: zindan rations – inmates get bread and water at 08:00 and 18:00, and can rest on the cell bench
    if (p.jailedDays > 0 && (w.hour === 8 || w.hour === 18)) { p.hunger = Math.min(p.hunger, 25); p.thirst = Math.min(p.thirst, 20); }
    if (!p.playerId || p.npc) { p.energy = 80; continue; }
    if ((p.onboardUntil ?? 0) > now) { p.energy = Math.max(p.energy ?? 100, 90); continue; }
    if (p.jailedDays > 0) { p.energy = clamp((p.energy ?? 80) + 3); continue; }
    const inside = (p.homeUntil ?? 0) > now;
    if (inside) { p.energy = clamp((p.energy ?? 80) + (p.sleeping ? 14 : 6)); p.health = clamp(p.health + (p.sleeping ? 1.5 : 0.5) * oldHeal(w, p)); }
    else { p.energy = clamp((p.energy ?? 80) - 4 * energyMul(p, w)); if ((p.energy ?? 0) < 15) p.mood = clamp(p.mood - 1); }
    if (!inside && p.sleeping) { p.sleeping = false; if (p.playerId) personal(w, p.playerId, 'Günaydın! Dinlenmiş uyandınız.'); }
  }
}
/** Capacity migration: nobody above 5 per house; couples together; NPC overflow moves to free houses. */
export function rehouse(w: World): void {
  const hs = houses(w); if (!hs.length) return; let moved = 0;
  for (const b of hs) {
    const rs = residents(w, b.id); if (!b.ownerId && rs[0]) b.ownerId = rs[0].id;
    if (rs.length <= HOUSE_CAP) continue;
    const keep = new Set<string>(); for (const p of rs) { if (keep.size >= HOUSE_CAP) break; if (keep.has(p.id)) continue; const sp = rs.find((x) => x.id === p.spouse); if (sp && keep.size + 2 > HOUSE_CAP) continue; keep.add(p.id); if (sp) keep.add(sp.id); }
    for (const p of rs) if (!keep.has(p.id)) { moved++;
      const to = hs.find((x) => freeSpots(w, x.id) >= (p.spouse && rs.some((y) => y.id === p.spouse && !keep.has(y.id)) ? 2 : 1));
      if (to) { p.home = to.id; const sp = rs.find((y) => y.id === p.spouse && !keep.has(y.id)); if (sp) { sp.home = to.id; keep.add(sp.id); } } else p.home = '';
      keep.add(p.id);
    }
  }
  if (moved) log(w, `🏠 Evlere en fazla 5 kişi sığar: ${moved} kişi boş evlere taşındı.`);
}
