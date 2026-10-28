/**
 * v1.9.9: salgın with individual infections, yangın that destroys buildings (warning first, ruins, rebuild),
 * and the empire's name chosen by the Kayzer.
 */
import { oldSick } from './age';
import type { Building, Person, World } from './types';
import { findPerson } from './world';
import { transfer } from './economy';
import { chance, clamp, pick, rand } from './rng';
import { disaster, seeDoctor } from './life';
import { log, personal } from './log';
import { die } from './family';
import { placePeople } from './place';
import { chronicle } from './realm';

// ---------------- salgın ----------------
export const SPREAD_R = 2; export const SPREAD_P = 0.06; export const SICK_DMG = 1.5;
export function infect(w: World, p: Person, now?: number): void {
  if (p.infected || p.prof === 'naip') return; p.infected = { day: w.day };
  if (p.playerId && !p.npc) personal(w, p.playerId, '🦠 HASTALANDINIZ! Salgına yakalandınız: her saat canınız azalıyor ve yanınızdakilere bulaştırabilirsiniz. Hemen Hekimhane’ye gidip tedavi olun (Hekim).', now);
}
export function plagueStart(w: World): void {
  const pool = w.people.filter((p) => p.prof !== 'naip' && p.exiledDays === 0); const n = Math.max(2, Math.round(pool.length * 0.05));
  for (let i = 0; i < n && pool.length; i++) infect(w, pool.splice(Math.floor(rand(w) * pool.length), 1)[0]!);
}
/** Hourly: spread by proximity during the salgın, damage the untreated, NPCs go to the hekim. */
export function plagueHour(w: World, now: number): void {
  const sick = w.people.filter((p) => p.infected); if (!sick.length) return;
  if (w.nature?.kind === 'salgin') {
    const placed = placePeople(w, now); const pos = new Map(placed.map((q) => [q.p.id, q]));
    for (const s of sick) { const a = pos.get(s.id); if (!a) continue; for (const q of placed) if (!q.p.infected && q.p.id !== s.id && Math.hypot(q.x - a.x, q.y - a.y) <= SPREAD_R && rand(w) < SPREAD_P * oldSick(w, q.p)) infect(w, q.p, now); }
  }
  for (const p of sick) {
    p.health = clamp(p.health - SICK_DMG * (oldSick(w, p) > 1 ? 1.3 : 1));
    if (p.health <= 0) { if (p.playerId && !p.npc) { p.health = 3; p.wounded = true; } else { die(w, p, `${p.name} salgından öldü.`); continue; } }
    if ((!p.playerId || p.npc) && p.jailedDays === 0 && chance(w, 0.35)) { const r = seeDoctor(w, p, true); if (!/hekim yok|yetmiyor/i.test(r)) cure(p); }
  }
}
export function cure(p: Person): void { p.infected = undefined; }

// ---------------- yangın ----------------
export const FIRE_WARN_H = 2; export const REBUILD_COST = 150;
const UNBURNABLE = new Set(['saray', 'meclis', 'mahkeme', 'zindan', 'cami', 'liman', 'pazar', 'gida', 'zanaat', 'yeni', 'festival', 'ciftlik']);
export function startFire(w: World, b: Building, cause: string): void {
  if (b.burned || w.fire) return;
  w.fire = { bid: b.id, startH: w.day * 24 + w.hour, cause };
  disaster(w, 'yangin', `YANGIN! ${b.name} yanıyor (${cause}). ${FIRE_WARN_H} saat içinde çökecek: içeridekiler hemen dışarı çıksın (Dışarı çık)! Çöktüğünde içeride kalan ölebilir ya da ağır yaralanır; bina yıkılır, sahibi mülkünü kaybeder (sonra ${REBUILD_COST} D ile yeniden yapılabilir), sandıktaki eşya yanar.`);
}
export function fireHour(w: World, now: number): void {
  const f = w.fire;
  if (!f) { if (w.hour === 14 && w.day > 10 && chance(w, 0.01)) { const c = w.buildings.filter((b) => !UNBURNABLE.has(b.id) && !b.burned && b.kind !== 'arsa'); if (c.length) startFire(w, pick(w, c), 'kazayla çıkan ateş'); } return; }
  if (w.day * 24 + w.hour - f.startH < FIRE_WARN_H) return;
  const b = w.buildings.find((x) => x.id === f.bid); w.fire = null; if (!b) return;
  const inside = w.people.filter((p) => p.home === b.id && (p.playerId && !p.npc ? (p.homeUntil ?? 0) > now : (w.hour >= 22 || w.hour < 6) && !p.nightOut && rand(w) < 0.5));
  const dead: string[] = []; const hurt: string[] = [];
  for (const p of inside) {
    if (p.playerId && !p.npc) { p.health = clamp(p.health - 60); if (p.health < 5) p.health = 5; p.wounded = true; p.homeUntil = 0; hurt.push(p.name); personal(w, p.playerId, '🔥 Eviniz çöktü! Son anda dışarı kaçtınız ama ağır yaralısınız. Hekimhane’ye gidin.', now); }
    else if (rand(w) < 0.4) { dead.push(p.name); die(w, p, `${p.name} yangında öldü.`); }
    else { p.health = clamp(p.health - 40); p.wounded = true; hurt.push(p.name); }
  }
  const owner = findPerson(w, b.ownerId); b.burned = { day: w.day, prevOwner: b.ownerId ?? null }; b.ownerId = undefined;
  if (w.chests?.[b.id]) delete w.chests[b.id];
  if (b.id === 'kisla') for (const p of w.people) if (p.prof === 'asker') p.loyalty = clamp(p.loyalty - 5);
  if (owner?.playerId) personal(w, owner.playerId, `🔥 ${b.name} yandı; mülkünüz yok oldu. ${REBUILD_COST} D ile yeniden yaptırabilirsiniz.`, now);
  disaster(w, 'yangin_sonu', `${b.name} yanıp çöktü. Ölen: ${dead.join(', ') || 'yok'}; yaralı: ${hurt.join(', ') || 'yok'}. ${owner ? `${owner.name} mülkünü kaybetti. ` : ''}Harabe ${REBUILD_COST} D ile yeniden yapılabilir (binaya dokunun → Yeniden yap).`);
}
export function rebuild(w: World, me: Person, bid: string): string {
  const b = w.buildings.find((x) => x.id === bid); if (!b?.burned) return 'Bu bina yanmamış.';
  const state = !b.burned.prevOwner && b.kind !== 'ev';
  if (!transfer(w, me.id, state ? 'dis' : 'dis', REBUILD_COST, 'yeniden inşa')) return `Yeniden yapım ${REBUILD_COST} D; paranız yetmiyor.`;
  if (b.kind === 'ev') b.ownerId = me.id; b.burned = undefined;
  log(w, `🏗 ${me.name}, ${b.name} binasını yeniden yaptırdı.`, me.id); return `${b.name} yeniden yapıldı${b.kind === 'ev' ? '; artık sizin' : ''}.`;
}

// ---------------- empire name ----------------
export function nameEmpire(w: World, me: Person, name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 40) return 'İsim 3–40 harf olmalı.';
  if (!/^[\p{L}\d' .-]+$/u.test(n)) return 'Sadece harf, rakam, boşluk, kesme ve tire.';
  const old = w.empireName; w.empireName = n; w.empireNamedBy = me.id;
  disaster(w, 'isim', `${me.name} ilan etti: devletimizin adı artık “${n}”${old ? ` (eski adı: ${old})` : ''}!`);
  chronicle(w, 'isim', `Devletin adı “${n}” konuldu.`);
  return null;
}
export const empire = (w: World): string => w.empireName || 'İmparatorluk';
