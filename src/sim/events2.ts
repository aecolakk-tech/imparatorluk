import { isOnline } from './log';
import { combatRecord } from './career';
/**
 * v1.9.9: big events, all rule-based (no AI calls), each announced with a popup (disaster()).
 * - Eşkıya baskını: warning at 09:00, 10 armed robbers 22:00–06:00, NPCs stay home, asker/bekçi fight, result popup.
 * - Yabancı devlet: haraç / vergiye bağlanma / savaş. War: 3 game days (the world clock only runs while someone is online),
 *   ships land troops at the river; paid recruits (capped pay, disbanded after); losses capped; captives recoverable by ransom.
 */
import type { Person, World } from './types';
import { findPerson } from './world';
import { transfer } from './economy';
import { chance, clamp, pick, rand } from './rng';
import { disaster } from './life';
import { log, personal } from './log';
import { die } from './family';
import { arms, bestWeapon, isUniformed, kislaKit, ARM_LABEL } from './arms';
import { combatTick, startRaidCombat, startWarCombat } from './combat';
import { SAIL_MS } from './combatpos';

export const RAID_N = 10; export const RAID_COOLDOWN = 10;
export const WAR_COOLDOWN = 30; export const RECRUIT_MAX = 15; export const RECRUIT_PAY = 6; export const RANSOM = 40; export const CAPTIVE_MAX = 5;
const STATES = ['Bizans İmparatorluğu', 'Venedik Cumhuriyeti', 'Memlûk Sultanlığı', 'Macar Krallığı', 'Ceneviz Cumhuriyeti', 'Akkoyunlu Beyliği'];

const fighting = (p: Person): boolean => isUniformed(p) && p.jailedDays === 0 && p.exiledDays === 0 && !p.captive && !(p.wounded && p.health <= 20);
function unitPower(p: Person): number {
  const a = arms(p); const wp = bestWeapon(p); const base = (wp === 'kilic' ? 0.8 : wp === 'yay' ? 0.6 : wp === 'hancer' ? 0.5 : 0.3) + ((a.yay ?? 0) && (a.ok ?? 0) && wp !== 'yay' ? 0.25 : 0) + ((a.kalkan ?? 0) ? 0.15 : 0);
  return base * (0.6 + p.loyalty / 250) * (p.prof === 'bekci' ? 0.7 : 1) * (p.wounded ? 0.5 : 1);
}
/** A defender is hit: NPC wounded→dies; players are only ever wounded (ağır yaralı). */
function hitDefender(w: World, p: Person, by: string, out: { dead: string[]; wounded: string[] }): void {
  if (p.wounded && p.health <= 40 && !(p.playerId && !p.npc)) { out.dead.push(p.name); die(w, p, `${p.name} ${by} karşısında şehit düştü.`); return; }
  p.health = clamp(p.health - ((arms(p).kalkan ?? 0) ? 30 : 45)); if (p.health < 5) p.health = 5; p.wounded = true; out.wounded.push(p.name);
  if (p.playerId) personal(w, p.playerId, `⚔ ${by} sizi yaraladı! Hekimhane’ye gidin.`);
}
function useAmmo(p: Person): void { const a = arms(p); if ((a.yay ?? 0) && (a.ok ?? 0)) a.ok = Math.max(0, (a.ok ?? 0) - 2); } // a volley of arrows

// ---------------- eşkıya baskını ----------------
export function raidHour(w: World, _now: number): void {
  const r = w.raid;
  if (!r) {
    if (w.hour === 9 && w.day >= (w.raidNext ?? 12) && !w.foreign?.landed && chance(w, 0.04)) startRaidWarning(w);
    return;
  }
  // v2.0.1: the night itself (and its real-time fight) is run by raidRealtime()
}
/** v2.0.1: called on every request – starts the raid night at 22:00 sharp and runs real-time combat. */
export function bigEventsRealtime(w: World, now: number): void {
  const r = w.raid;
  if (r?.phase === 'uyari' && ((w.day === r.day && w.hour >= 22) || w.day > r.day)) startNight(w, now);
  if (r?.phase === 'gece' && !w.combat) startRaidCombat(w, now, (r.robbers ?? []).filter((x) => x.hp > 0).length || RAID_N); // deployed mid-raid
  const f = w.foreign; if (f && f.phase === 'savas' && !f.landed && f.landReal && now >= f.landReal) landNow(w, now); // admin-scheduled landing at a real time
  if (f?.landed && f.phase === 'savas' && !w.combat) { startWarCombat(w, now - SAIL_MS, f.alive ?? f.troops); }
  combatTick(w, now, (kind, won) => { if (kind === 'raid' && w.raid) endRaid(w, won); else if (kind === 'war' && w.foreign) warEnd(w, won); else w.combat = null; });
}
function startNight(w: World, now: number): void {
  const r = w.raid!; r.phase = 'gece'; r.robbers = Array.from({ length: RAID_N }, (_, i) => ({ id: `R${i}`, hp: 2 })); r.startAt = now;
  for (const p of w.people) if (!p.playerId || p.npc) p.nightOut = false;
  startRaidCombat(w, now, RAID_N);
  disaster(w, 'baskin', `EŞKIYA ŞEHİRDE! (saat ${String(w.hour).padStart(2, '0')}:00) ${RAID_N} kılıçlı, yaylı eşkıya sokaklarda. Dışarıda yakaladıklarını soyuyorlar. Evinize girin (Eve git) – evdekilere dokunamazlar. Asker ve bekçiler savaşıyor. Silahınız varsa alttaki hızlı çubuktan seçin ve eşkıyaya dokunun ya da ‘Saldır’a basın.`);
}
export function startRaidWarning(w: World): void {
  w.raid = { phase: 'uyari', day: w.day };
  disaster(w, 'baskin_uyari', `Bu gece silahlı eşkıya bekleniyor! ${RAID_N} eşkıya saat 22:00’de şehre girecek, sabaha kadar sokakta yakaladıklarını soyup öldürecek. Yapılacaklar: gece dışarıda kalmayın (eve gidin); paranızı sandığa koyun; asker/bekçiyseniz Kışla’dan teçhizat alın. NPC’ler bu gece evden çıkmayacak.`);
}
function endRaid(w: World, won: boolean): void {
  const r = w.raid!; const cb = w.combat as (NonNullable<World['combat']> & { fallen?: string[]; hurt?: string[] }) | null | undefined; if (cb) { r.defDead = [...(r.defDead ?? []), ...(cb.fallen ?? [])]; r.defHurt = [...new Set([...(r.defHurt ?? []), ...(cb.hurt ?? [])])]; } w.combat = null; const killed = r.killed ?? 0; r.hurt = [...new Set(r.hurt ?? [])]; r.defHurt = [...new Set(r.defHurt ?? [])]; r.dead = [...new Set(r.dead ?? [])];
  { const fo = cb?.fought ?? {}; const now = w.serverNow ?? w.lastTickAt; combatRecord(w, 'raid', Object.keys(fo), fo, won, w.people.filter((p) => p.prof === 'asker' && p.playerId && !p.npc && isOnline(w, p.playerId, now, 300_000)).map((p) => p.id)); }
  let recovered = 0; if (r.stolen) { recovered = Math.round(r.stolen * killed / RAID_N * 100) / 100; if (recovered > 0) transfer(w, 'dis', 'saray', recovered, 'eşkıyadan geri alınan ganimet'); }
  for (const p of w.people) if (isUniformed(p)) { p.loyalty = clamp(p.loyalty + (won ? 5 : -3)); }
  disaster(w, won ? 'baskin_zafer' : 'baskin_sonu', `${won ? 'EŞKIYA PÜSKÜRTÜLDÜ!' : 'Eşkıya sabah çekildi.'} Öldürülen eşkıya: ${killed}/${RAID_N}. Çalınan: ${Math.round(r.stolen ?? 0)} D, geri alınıp hazineye konan: ${Math.round(recovered)} D. Ölen siviller: ${(r.dead ?? []).join(', ') || 'yok'}. Ağır yaralı: ${(r.hurt ?? []).join(', ') || 'yok'}. Şehit asker/bekçi: ${(r.defDead ?? []).join(', ') || 'yok'}; yaralı: ${(r.defHurt ?? []).length}.`);
  w.raid = null; w.raidNext = w.day + RAID_COOLDOWN;
}

// ---------------- yabancı devlet ----------------
export function foreignHour(w: World, now: number): void {
  const f = w.foreign;
  if (!f) {
    if (w.hour === 9 && w.day >= (w.warNext ?? 25) && !w.raid && !w.isyan && chance(w, 0.02)) startForeign(w);
    return;
  }
  if (f.phase === 'talep' && w.day >= f.deadline && w.hour >= 12) answerForeign(w, 'war', true);
  if (f.phase === 'savas' && !f.landReal && w.day >= f.landDay! && w.hour >= 8 && !f.landed) landNow(w, now);
  if (f.landed && f.phase === 'savas' && !w.combat) battleHour(w);
}
/** The ships enter the river: they sail up to the Liman (SAIL_MS), then the troops land and march (combat.ts). */
function landNow(w: World, now: number): void {
  const f = w.foreign!;
  {
    f.landed = true; f.landAt = now; f.alive = f.troops; startWarCombat(w, now, f.troops);
    disaster(w, 'cikarma', `${f.name} gemileri nehirden Liman’a yanaşıyor! ~${Math.round(SAIL_MS / 1000)} saniye içinde ${f.troops} düşman askeri karaya çıkıp şehre yürüyecek. Asker ve bekçilerimiz savaşıyor. Siviller evlerine girsin. Hepsi öldürülürse zafer; askerlerimizin hepsi düşerse ${f.name} haraç, mal ve esir alır.`);
  }
}
export function startForeign(w: World): void {
  const wars = w.wars ?? 0; const ours = w.people.filter(fighting).reduce((s, p) => s + unitPower(p), 0); // difficulty follows our real strength
  const troops = Math.max(8, Math.min(45, Math.round(Math.max(6, ours) * (1.2 + 0.25 * wars))));
  const demand = Math.round(Math.max(1500, w.treasury * 0.5) * (1 + 0.25 * wars));
  w.foreign = { name: pick(w, STATES), demand, troops, phase: 'talep', day: w.day, deadline: w.day + 2, recruits: [] };
  disaster(w, 'devlet', `${w.foreign.name} elçisi ${w.empireName ?? 'devletimize'} geldi: ya ${demand} Dinar haraç, ya da ${w.empireName ?? 'şehir'} ${w.foreign.name}’na vergiye bağlansın (20 gün boyunca her gün hazinenin %3’ü). Reddedilirse savaş: 3 gün sonra ~${troops} asker gemilerle nehirden çıkarma yapar. Bu 3 günde Kayzer ücretli asker toplayabilir (en fazla ${RECRUIT_MAX}, günlük ${RECRUIT_PAY} D, savaştan sonra terhis). Kararı Kayzer verir (${w.foreign.deadline}. gün öğlene kadar; cevap yoksa savaş).`);
}
export function answerForeign(w: World, choice: 'pay' | 'vassal' | 'war', auto = false): string {
  const f = w.foreign; if (!f || f.phase !== 'talep') return 'Bekleyen bir elçi yok.';
  if (choice === 'pay') {
    if (!transfer(w, 'saray', 'dis', f.demand, `${f.name} haracı`)) return 'Hazine yetmiyor.';
    for (const p of w.people) { if (p.prof === 'asker') p.loyalty = clamp(p.loyalty - 5); p.mood = clamp(p.mood - 2); }
    disaster(w, 'devlet_sonu', `${f.name}’na ${f.demand} D haraç ödendi. Savaş olmayacak; askerler bu aşağılanmadan hoşnut değil (sadakat −5).`); endForeign(w, false); return 'Haraç ödendi.';
  }
  if (choice === 'vassal') {
    w.vassal = { name: f.name, until: w.day + 20 };
    for (const p of w.people) { p.republic = clamp((p.republic ?? 0) + 3); p.mood = clamp(p.mood - 3); }
    disaster(w, 'devlet_sonu', `Şehir 20 gün ${f.name}’na vergiye bağlandı: her gün hazinenin %3’ü onlara gidecek. Halk memnun değil (moral −3, cumhuriyetçilik +3).`); endForeign(w, false); return 'Vergiye bağlandık.';
  }
  f.phase = 'savas'; f.landDay = w.day + 3;
  disaster(w, 'savas', `${auto ? 'Cevap verilmedi: ' : ''}SAVAŞ! ${f.name} ${f.landDay}. gün sabah ~${f.troops} askerle nehirden çıkarma yapacak (sayaç sadece biri çevrimiçiyken ilerler). Hazırlık: Kayzer ücretli asker toplayabilir (Yönetim/duyuru penceresi); asker ve bekçiler Kışla’dan teçhizat alsın; ok Demirci’de.`);
  return 'Savaş ilan edildi.';
}
export function recruit(w: World, n: number): string {
  const f = w.foreign; if (!f || f.phase === 'talep' && false) return 'Savaş yokken asker toplanmaz.';
  if (!f || (f.phase !== 'savas' && f.phase !== 'talep')) return 'Savaş yokken asker toplanmaz.';
  const room = RECRUIT_MAX - f.recruits.length; if (room <= 0) return `En fazla ${RECRUIT_MAX} ücretli asker.`;
  const pool = w.people.filter((p) => !p.playerId && !isUniformed(p) && p.jailedDays === 0 && p.exiledDays === 0 && !p.captive && ['hamal', 'ciftci', 'insaatci', 'balikci', 'sucu'].includes(p.prof) && !p.meclis && p.health > 50);
  const take = pool.slice(0, Math.min(room, Math.max(1, Math.floor(n))));
  if (!take.length) return 'Gönüllü bulunamadı.';
  if (w.treasury < take.length * (RECRUIT_PAY + 5)) return 'Hazine yetmiyor (asker başına peşin 5 D + günlük ücret).';
  for (const p of take) { p.recruit = { prof: p.prof, work: p.work }; p.prof = 'asker'; p.work = 'kisla'; transfer(w, 'saray', p.id, 5, 'askere alma peşinatı'); p.kitDay = -99; kislaKit(w, p); f.recruits.push(p.id); }
  log(w, `⚔ ${take.length} kişi ücretli askere alındı (günlük ${RECRUIT_PAY} D, savaştan sonra terhis).`);
  return `${take.length} asker alındı. Toplam ücretli: ${f.recruits.length}/${RECRUIT_MAX}.`;
}
export function payRecruits(w: World): void {
  const f = w.foreign; if (f) for (const id of f.recruits) { const p = findPerson(w, id); if (p && transfer(w, 'saray', p.id, RECRUIT_PAY, 'ücretli asker')) p.incomeToday += RECRUIT_PAY; }
  if (w.vassal) { if (w.day > w.vassal.until) { log(w, `${w.vassal.name}’na vergi bağlılığı sona erdi.`); w.vassal = null; } else { const t = Math.min(200, Math.round(w.treasury * 0.03)); transfer(w, 'saray', 'dis', t, `${w.vassal.name} vergisi`); } }
}
function battleHour(w: World): void {
  const f = w.foreign!; const diff = 1 + 0.1 * (w.wars ?? 0);
  const ours = w.people.filter(fighting); const res = { dead: [] as string[], wounded: [] as string[] };
  let kills = 0; for (const d of ours) { if (f.alive! <= kills) break; if (rand(w) < unitPower(d) * 0.18) { kills += 1; useAmmo(d); d.xp += 2; } }
  f.alive = Math.max(0, f.alive! - kills); f.killed = (f.killed ?? 0) + kills;
  for (let i = 0; i < f.alive!; i++) { const live = w.people.filter(fighting); if (!live.length) break; if (rand(w) < 0.2 * diff) hitDefender(w, pick(w, live), `${f.name} askeri`, res); }
  f.ourDead = [...(f.ourDead ?? []), ...res.dead]; f.ourHurt = (f.ourHurt ?? 0) + res.wounded.length;
  if (f.alive === 0) warEnd(w, true); else if (!w.people.some(fighting)) warEnd(w, false);
}
function warEnd(w: World, won: boolean): void {
  const f = w.foreign!; const cb = w.combat as (NonNullable<World['combat']> & { fallen?: string[]; hurt?: string[] }) | null | undefined; if (cb) { f.ourDead = [...(f.ourDead ?? []), ...(cb.fallen ?? [])]; f.ourHurt = (f.ourHurt ?? 0) + (cb.hurt ?? []).length; } w.combat = null;
  { const fo = cb?.fought ?? {}; const now = w.serverNow ?? w.lastTickAt; combatRecord(w, 'war', Object.keys(fo), fo, won, w.people.filter((p) => p.prof === 'asker' && p.playerId && !p.npc && isOnline(w, p.playerId, now, 300_000)).map((p) => p.id)); }
  if (won) {
    const loot = Math.round(f.demand * 0.3); transfer(w, 'dis', 'saray', loot, 'savaş ganimeti');
    for (const p of w.people) { if (isUniformed(p)) p.loyalty = clamp(p.loyalty + 8); p.mood = clamp(p.mood + 5); }
    disaster(w, 'savas_zafer', `ZAFER! ${f.name} ordusunun ${f.troops} askerinin hepsi öldürüldü. ${loot} D ganimet hazineye girdi. Şehit: ${(f.ourDead ?? []).join(', ') || 'yok'}; yaralı: ${f.ourHurt ?? 0}. Herkesin morali +5.`);
  } else {
    const cash = Math.round(Math.min(f.demand, w.treasury * 0.5)); transfer(w, 'saray', 'dis', cash, `${f.name} savaş tazminatı`);
    const grain = Math.min(200, Math.round(w.granary * 0.3)); w.granary -= grain;
    const pool = w.people.filter((p) => !p.playerId && !isUniformed(p) && p.prof !== 'naip' && p.id !== w.kayzerId && !p.soylu && p.exiledDays === 0 && p.jailedDays === 0);
    const n = Math.min(CAPTIVE_MAX, Math.round(w.people.length * 0.04)); const caps: string[] = [];
    for (let i = 0; i < n && pool.length; i++) { const p = pool.splice(Math.floor(rand(w) * pool.length), 1)[0]!; p.captive = { by: f.name, day: w.day }; p.exiledDays = 9999; caps.push(p.name); }
    for (const p of w.people) { p.mood = clamp(p.mood - 8); p.loyalty = clamp(p.loyalty - 5); }
    disaster(w, 'savas_yenilgi', `YENİLGİ! Askerlerimizin hepsi düştü ya da yaralandı. ${f.name}: ${cash} D tazminat, ambardan ${grain} buğday ve ${caps.length} esir aldı (${caps.join(', ') || '—'}). Esirler ölmedi: Kayzer Saray’dan kişi başı ${RANSOM} D fidye ödeyerek geri alabilir. Şehit: ${(f.ourDead ?? []).join(', ') || 'yok'}.`);
  }
  endForeign(w, true);
}
function endForeign(w: World, fought: boolean): void {
  const f = w.foreign!;
  for (const id of f.recruits) { const p = findPerson(w, id); if (p?.recruit) { p.prof = p.recruit.prof as Person['prof']; p.work = p.recruit.work; p.recruit = undefined; p.arms = {}; p.drawn = null; w.armsReg = (w.armsReg ?? []).filter((r) => r.ownerId !== p.id); } }
  if (f.recruits.length) log(w, `${f.recruits.length} ücretli asker terhis edildi; teçhizat Kışla’ya iade edildi.`);
  w.foreign = null; w.warNext = w.day + WAR_COOLDOWN; if (fought) w.wars = (w.wars ?? 0) + 1;
}
export function ransom(w: World, id: string): string {
  const p = findPerson(w, id); if (!p?.captive) return 'Böyle bir esir yok.';
  if (!transfer(w, 'saray', 'dis', RANSOM, 'esir fidyesi')) return 'Hazine yetmiyor.';
  const by = p.captive.by; p.captive = undefined; p.exiledDays = 0; p.mood = clamp(p.mood + 20); p.loyalty = clamp(p.loyalty + 15);
  log(w, `🕊 ${p.name}, ${by} esaretinden fidyeyle kurtarıldı ve şehre döndü.`, p.id); return `${p.name} geri geldi.`;
}
export { ARM_LABEL };
