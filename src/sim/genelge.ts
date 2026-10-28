/**
 * v2.0.1 genelge catalogue: every Meclis genelge has a real, measurable effect, a duration (game days) and a hazine cost.
 * Active genelgeler live in w.genelgeler; other modules read their multipliers through fx(w, key).
 * When one ends, the gazete reports the measured before → after numbers.
 */
import type { Person, World } from './types';
import { transfer } from './economy';
import { clamp, pick, chance } from './rng';
import { log } from './log';
import { shelf, granaryDistribute } from './market2';
import { enlist } from './career';
import { yearsOf } from './age';
import { partyOnGenelge } from './party';

export type GKind = 'ambar' | 'kuyu' | 'vergiIndirim' | 'vergiArtirim' | 'ickiYasak' | 'ickiSerbest' | 'fiyatTavani' | 'ithalat' | 'bekci' | 'asevi' | 'okul' | 'yol' | 'saglik' | 'senlik' | 'asker' | 'liman';
export interface GDef { axes: [number, number, number]; label: string; cost: number; days: number; desc: string; metric: (w: World) => number; unit: string; better: 'down' | 'up'; what: string; needs?: (w: World) => string | null }
const avg = (w: World, f: (p: Person) => number): number => { const ps = w.people.filter((p) => p.prof !== 'naip'); return ps.reduce((s, p) => s + f(p), 0) / Math.max(1, ps.length); };
const price = (g: 'ekmek' | 'su' | 'bugday') => (w: World): number => shelf(w, g, 'carsi').price ?? w.prices[g];
export const GENELGE: Record<GKind, GDef> = {
  ambar: { axes: [0, 1, 0], label: 'Kıtlığa karşı ambar çağrısı', cost: 0, days: 3, desc: '3 gün boyunca saray ambarından her gün 60 buğday değirmenlere verilir (ekmek ≈ %10 ucuzlar).', metric: price('ekmek'), unit: 'D', better: 'down', what: 'ekmek', needs: (w) => (w.granary >= 120 ? null : 'Ambarda yeterli buğday yok (en az 120).') },
  kuyu: { axes: [0, 0.5, 0], label: 'Kuyuların temizliği', cost: 150, days: 10, desc: 'Kuyular temizlenir: su üretimi +%30, salgın bulaşma riski −%40 (10 gün).', metric: price('su'), unit: 'D', better: 'down', what: 'su' },
  vergiIndirim: { axes: [0, -1, 0], label: 'Vergi indirimi', cost: 0, days: 10, desc: 'Satış vergisi 10 gün 3 puan düşer; esnaf rahatlar, hazine geliri azalır.', metric: (w) => w.taxRate, unit: '%', better: 'down', what: 'vergi', needs: (w) => (w.taxRate >= 3 ? null : 'Vergi zaten çok düşük.') },
  vergiArtirim: { axes: [-0.5, 0.5, 0], label: 'Vergi artırımı', cost: 0, days: 10, desc: 'Satış vergisi 10 gün 3 puan artar; hazine dolar, halk memnuniyeti biraz düşer.', metric: (w) => w.taxRate, unit: '%', better: 'up', what: 'vergi', needs: (w) => (w.treasury >= 4000 ? `Hazinede ${Math.round(w.treasury)} D var; vergi artırımı ancak hazine 4000 D’nin altındayken önerilebilir.` : w.taxRate <= 30 ? null : 'Vergi zaten çok yüksek.') },
  ickiYasak: { axes: [-0.3, 0, -1], label: 'İçki yasağı', cost: 0, days: 10, desc: 'Meyhane 10 gün kapanır; dindarlar memnun, ötekiler kızgın.', metric: (w) => avg(w, (p) => p.mood), unit: '', better: 'up', what: 'memnuniyet', needs: (w) => (w.bans.includes('icki') ? 'İçki zaten yasak.' : null) },
  ickiSerbest: { axes: [0.3, 0, 1], label: 'İçki serbestliği', cost: 0, days: 10, desc: 'İçki yasağı 10 gün kalkar.', metric: (w) => avg(w, (p) => p.mood), unit: '', better: 'up', what: 'memnuniyet', needs: (w) => (w.bans.includes('icki') ? null : 'İçki zaten serbest.') },
  fiyatTavani: { axes: [0, 1, 0], label: 'Ekmeğe fiyat tavanı (narh)', cost: 0, days: 5, desc: 'Ekmeğe 5 gün narh konur: fiyat düşer ama fırıncı az üretir, karaborsa çıkabilir.', metric: price('ekmek'), unit: 'D', better: 'down', what: 'ekmek' },
  ithalat: { axes: [0, -0.8, 0], label: 'İthalat izni ve gümrük kolaylığı', cost: 50, days: 10, desc: 'Liman toptancısı 10 gün %30 fazla mal getirir; buğday ve ekmek ucuzlar.', metric: price('bugday'), unit: 'D', better: 'down', what: 'buğday' },
  bekci: { axes: [-0.3, 0, 0], label: 'Bekçi devriyesi', cost: 120, days: 10, desc: 'Gece devriyesi: hırsızlık −%40 (10 gün).', metric: (w) => w.cases.filter((c) => c.crime === 'hirsizlik' && c.day >= w.day - 5).length, unit: 'dava', better: 'down', what: 'hırsızlık davası (5 gün)' },
  asevi: { axes: [0, 0.8, -0.3], label: 'Aşevi desteği', cost: 120, days: 10, desc: 'Cami aşevi günde iki kat çorba verir (10 gün).', metric: (w) => w.people.filter((p) => p.hunger >= 60).length, unit: 'kişi', better: 'down', what: 'aç insan' },
  okul: { axes: [0.4, 0.3, 0.5], label: 'Okul ve çıraklık desteği', cost: 150, days: 10, desc: 'Çıraklar ve kalfalar her gün +2 tecrübe kazanır; okul ücretsiz (10 gün).', metric: (w) => avg(w, (p) => p.xp), unit: 'tecrübe', better: 'up', what: 'ortalama tecrübe' },
  yol: { axes: [0, -0.4, 0], label: 'Yol onarımı', cost: 300, days: 15, desc: 'Yollar onarılır: yürüyüş +%10, liman toptan fiyatı −%5 (15 gün).', metric: price('bugday'), unit: 'D', better: 'down', what: 'buğday' },
  saglik: { axes: [0, 0.6, 0], label: 'Sağlık ve hekim desteği', cost: 150, days: 7, desc: 'Darülaceze: herkes günde +3 sağlık, hastaların yarısı tedavi edilir (7 gün).', metric: (w) => w.people.filter((p) => p.infected || p.health < 50).length, unit: 'kişi', better: 'down', what: 'hasta/zayıf' },
  senlik: { axes: [0.1, 0, 0.4], label: 'Şenlik düzenlenmesi', cost: 200, days: 2, desc: 'Meydanda iki günlük şenlik: herkes +5 mutluluk.', metric: (w) => avg(w, (p) => p.mood), unit: '', better: 'up', what: 'mutluluk' },
  asker: { axes: [-1, 0, 0], label: 'Asker toplanması', cost: 100, days: 5, desc: 'Boştaki 4 genç gönüllü askere yazılır; ordu güçlenir.', metric: (w) => w.people.filter((p) => p.prof === 'asker').length, unit: 'asker', better: 'up', what: 'asker sayısı' },
  liman: { axes: [-0.3, -0.3, 0], label: 'Liman güvenliği', cost: 120, days: 10, desc: 'Limana nöbet: eşkıya baskını ihtimali −%50, toptancı stoku +%20 (10 gün).', metric: (w) => w.listings.filter((l) => l.wholesale).reduce((s, l) => s + l.qty, 0), unit: 'mal', better: 'up', what: 'liman toptan stoku' },
};
export const GKINDS = Object.keys(GENELGE) as GKind[];
export const isGKind = (x: string): x is GKind => (GKINDS as string[]).includes(x);
export interface ActiveG { kind: GKind; from: number; until: number; before: number; billId?: string; by?: string | null; result?: number }
const act = (w: World): ActiveG[] => (w.genelgeler ??= []);
export const activeG = (w: World, k: GKind): boolean => act(w).some((g) => g.kind === k && g.until >= w.day);

/** Multipliers other systems read. */
export function fx(w: World, key: 'su' | 'salgin' | 'suc' | 'yol' | 'asevi' | 'baskin' | 'ithalat' | 'limanStok'): number {
  const on = (k: GKind): boolean => activeG(w, k);
  switch (key) {
    case 'su': return on('kuyu') ? 1.3 : 1;
    case 'salgin': return on('kuyu') ? 0.6 : 1;
    case 'suc': return on('bekci') ? 0.6 : 1;
    case 'yol': return on('yol') ? 1.1 : 1;
    case 'asevi': return on('asevi') ? 2 : 1;
    case 'baskin': return on('liman') ? 0.5 : 1;
    case 'ithalat': return (on('ithalat') ? 1.3 : 1) * (on('liman') ? 1.2 : 1);
    case 'limanStok': return on('yol') ? 0.95 : 1;
  }
}
/** Why a genelge can't be adopted now (hazine, preconditions, duplicate). */
export function gBlock(w: World, k: GKind, borc = false): string | null {
  const d = GENELGE[k]; if (activeG(w, k)) return `“${d.label}” zaten yürürlükte (${act(w).find((g) => g.kind === k)!.until}. güne kadar).`;
  if (!borc && d.cost > 0 && w.treasury - d.cost < 300) return `Hazine yetersiz: ${d.label} ${d.cost} D ister, hazinede ${Math.round(w.treasury)} D var (en az 300 D yedek kalmalı).`;
  return d.needs?.(w) ?? null;
}
/** Enact a genelge: pay its cost, start its effect and remember the starting measurement. Returns the result text. */
export function enactG(w: World, k: GKind, billId?: string, by?: string | null): string {
  const e = gBlock(w, k); if (e) return e;
  const d = GENELGE[k]; if (d.cost > 0 && !transfer(w, 'saray', 'dis', d.cost, `genelge: ${d.label}`)) return 'Hazine yetersiz.';
  const g: ActiveG = { kind: k, from: w.day, until: w.day + d.days - 1, before: Math.round(d.metric(w) * 100) / 100, billId, by: by ?? null }; act(w).push(g);
  switch (k) {
    case 'ambar': granaryDistribute(w, 60); break;
    case 'vergiIndirim': w.taxRate = Math.max(0, w.taxRate - 3); break;
    case 'vergiArtirim': w.taxRate = Math.min(40, w.taxRate + 3); for (const p of w.people) p.mood = clamp(p.mood - 2); break;
    case 'ickiYasak': w.bans = [...new Set([...w.bans, 'icki'])]; for (const p of w.people) { if (p.din >= 60) p.loyalty = clamp(p.loyalty + 3); else if (p.din < 35) p.mood = clamp(p.mood - 3); } break;
    case 'ickiSerbest': w.bans = w.bans.filter((b) => b !== 'icki'); for (const p of w.people) { if (p.din >= 60) p.loyalty = clamp(p.loyalty - 2); else p.mood = clamp(p.mood + 2); } break;
    case 'fiyatTavani': w.priceCaps.ekmek = Math.round((w.prices.ekmek ?? 1.2) * 0.85 * 100) / 100; break;
    case 'ithalat': w.imports = true; break;
    case 'senlik': w.festivalUntil = Math.max(w.festivalUntil ?? 0, w.day + 1); for (const p of w.people) p.mood = clamp(p.mood + 5); break;
    case 'asker': { const pool = w.people.filter((p) => !p.playerId && p.prof === 'hamal' && !p.female && yearsOf(w, p) >= 16 && yearsOf(w, p) < 45).slice(0, 4); for (const p of pool) { enlist(w, p, false); p.askerRank = 1; } break; }
    default: break;
  }
  log(w, `📜 Genelge yürürlükte: ${d.label} (${d.days} gün${d.cost ? `, hazineden ${d.cost} D` : ''}). Şu an ${d.what}: ${fmtN(g.before)} ${d.unit}.`);
  return `yürürlükte: ${d.desc}`;
}
const fmtN = (x: number): string => (Math.round(x * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
/** Daily: continuing effects, endings with before → after reports. Called from marketDay at the end of the day. */
export function genelgeDay(w: World): void {
  const list = act(w);
  for (const g of list) {
    if (g.until < w.day - 30) continue;
    const live = g.until >= w.day;
    if (live) switch (g.kind) {
      case 'ambar': if (w.day > g.from) granaryDistribute(w, 60); break;
      case 'okul': for (const p of w.people) if (p.xp < 60) p.xp += 2; break;
      case 'saglik': for (const p of w.people) { p.health = clamp(p.health + 3); if (p.infected && chance(w, 0.5)) p.infected = undefined; } break;
      case 'fiyatTavani': break;
      default: break;
    }
    if (g.until === w.day) endG(w, g);
  }
  w.genelgeler = list.filter((g) => g.until >= w.day - 30);
}
/** v2.0.1 'Kanunu/genelgeyi kaldır': end an active genelge early (its temporary changes are undone). */
export function cancelG(w: World, k: GKind): boolean { const g = act(w).find((x) => x.kind === k && x.until >= w.day); if (!g) return false; g.until = w.day; endG(w, g); g.until = w.day - 1; return true; }
function endG(w: World, g: ActiveG): void {
  const d = GENELGE[g.kind]; const after = Math.round(d.metric(w) * 100) / 100;
  switch (g.kind) { // undo temporary changes
    case 'vergiIndirim': w.taxRate = Math.min(40, w.taxRate + 3); break;
    case 'vergiArtirim': w.taxRate = Math.max(0, w.taxRate - 3); break;
    case 'ickiYasak': w.bans = w.bans.filter((b) => b !== 'icki'); break;
    case 'fiyatTavani': delete w.priceCaps.ekmek; break;
    default: break;
  }
  const good = d.better === 'down' ? after < g.before : after > g.before; const same = Math.abs(after - g.before) < 0.005;
  const verb = same ? 'değişmedi' : after < g.before ? 'indi' : 'çıktı';
  const text = same ? `Genelge “${d.label}” bitti: ${d.what} ${fmtN(after)} ${d.unit} ile değişmedi.` : `Genelge “${d.label}” bitti: ${good ? 'genelge sayesinde' : 'genelgeye rağmen'} ${d.what} ${fmtN(g.before)} ${d.unit}’den ${fmtN(after)} ${d.unit}’ye ${verb}.`;
  log(w, `📜 ${text}`); (w.gnews ??= []).push({ day: w.day, text });
  g.result = same ? 0 : good ? 1 : -1;
  partyOnGenelge(w, g);
}
/** Pick a sensible genelge from city conditions (NPC MPs). */
export function suggestG(w: World, ideology: string): GKind | null {
  const bread = price('ekmek')(w); const sick = w.people.filter((p) => p.infected).length; const hungry = w.people.filter((p) => p.hunger >= 60).length;
  const c: GKind[] = [];
  if (bread > 2.2) c.push('ambar', 'ithalat'); if (bread > 3) c.push('fiyatTavani');
  if (sick >= 3 || w.nature?.kind === 'salgin') c.push('saglik', 'kuyu');
  if (hungry >= 6) c.push('asevi');
  if (w.cases.filter((x) => x.crime === 'hirsizlik' && x.day >= w.day - 5).length >= 3) c.push('bekci');
  if (w.raid || (w.raidNext ?? 99) - w.day < 5) c.push('liman');
  if (ideology === 'esnaf' && w.taxRate > 10) c.push('vergiIndirim'); if (ideology === 'saltanatci' && w.treasury < 1500) c.push('vergiArtirim');
  if (ideology === 'saltanatci' && w.people.filter((p) => p.prof === 'asker').length < 6) c.push('asker');
  if (ideology === 'halkci') c.push('okul', 'senlik'); if (ideology === 'esnaf') c.push('yol');
  const ok = c.filter((k) => !gBlock(w, k)); return ok.length ? pick(w, ok) : null;
}
