/**
 * v2.0.1 yükselme yolu, itibar, iş bulma, asker and din-ilim paths.
 * Main path: Dilenci → İşçi → Çırak → Usta → Tüccar → Eşraf → Soylu → Kayzer'e danışman.
 * Side paths: Asker (Acemi er → Er → Onbaşı → Çavuş → Yüzbaşı → Komutan) and Din-İlim (Talebe → Hoca → Kadı).
 * Money only moves through transfer(); wages come from the employer's purse, the saray or the outside world ('dis').
 */
import type { Job, MainRank, Person, Profession, World } from './types';
import { PRODUCES, PROF_LABEL } from './constants';
import { transfer } from './economy';
import { clamp, nextId } from './rng';
import { findPerson, WORKPLACE } from './world';
import { log, personal, isOnline } from './log';
import { distToBuilding, REACH } from './move';
import { myPos } from './v16';
import { yearsOf } from './age';
import { wageMul } from './market2';
import { isSoldierJob } from './jobtask';

export const MAIN: MainRank[] = ['dilenci', 'isci', 'cirak', 'usta', 'tuccar', 'esraf', 'soylu', 'danisman'];
export const MAIN_LABEL: Record<MainRank, string> = { dilenci: 'Dilenci', isci: 'İşçi', cirak: 'Çırak', usta: 'Usta', tuccar: 'Tüccar', esraf: 'Eşraf', soylu: 'Soylu', danisman: 'Kayzer’e danışman' };
export const ASKER_LABEL = ['Acemi er', 'Er', 'Onbaşı', 'Çavuş', 'Yüzbaşı', 'Komutan'];
export const ASKER_WAGE = [0.5, 1, 1.3, 1.6, 2.5, 3];
export const ILIM_LABEL = ['Talebe', 'Hoca', 'Kadı'];
export const ITIBAR_START = 10;
const STATE: Profession[] = ['memur', 'tahsildar', 'bekci', 'savci', 'hakim', 'asker', 'hoca', 'imam'];
const isPlayer = (p: Person): boolean => !!p.playerId && !p.npc;
const tell = (w: World, p: Person, msg: string): void => { if (p.playerId) personal(w, p.playerId, msg); };
const cs = (p: Person): NonNullable<Person['cs']> => (p.cs ??= {});
const idx = (r: MainRank | undefined): number => MAIN.indexOf(r ?? 'isci');

// ---------------- notes ('Neden değişti') ----------------
export function note(w: World, p: Person, kind: 'itibar' | 'din', d: number, why: string): void {
  if (!d) return; const n = (p.notes ??= []); n.push({ day: w.day, hour: w.hour, kind, d: Math.round(d * 10) / 10, why }); if (n.length > 8) n.splice(0, n.length - 8);
}
// ---------------- itibar ----------------
export const itibarOf = (p: Person): number => p.itibar ?? ITIBAR_START;
/** Change itibar (0..100). Falling below 0 costs one rank (main path or asker) and leaves itibar at 0. */
export function itibar(w: World, p: Person, d: number, why: string): void {
  const before = itibarOf(p); let v = before + d;
  if (v < 0) { demote(w, p, 1, `itibar sıfırın altına düştü (${why})`); v = 0; }
  p.itibar = Math.round(clamp(v, 0, 100) * 10) / 10; note(w, p, 'itibar', p.itibar - before, why);
  if (isPlayer(p) && Math.abs(d) >= 1) tell(w, p, `${d > 0 ? '⭐' : '⚠️'} İtibar ${d > 0 ? '+' : ''}${Math.round(d)}: ${why} (şimdi ${Math.round(p.itibar)})`);
}
/** Market price multiplier from itibar: respected people get a discount, disreputable ones pay more. */
export function itibarPriceMul(p: Person | undefined): number { if (!p || p.npc !== false && !p.playerId) return 1; const i = itibarOf(p); return i >= 80 ? 0.92 : i >= 60 ? 0.95 : i < 5 ? 1.1 : 1; }

// ---------------- rank ----------------
export function rankOf(p: Person): MainRank { return p.soylu || p.rank ? (p.yol === 'danisman' ? 'danisman' : 'soylu') : (p.yol ?? 'isci'); }
export function rankLabel(w: World, p: Person): string {
  if (p.id === w.kayzerId) return w.regime === 'cumhuriyet' ? 'Başkan' : 'Kayzer';
  if (p.prof === 'asker') return ASKER_LABEL[p.askerRank ?? 1]!;
  if (p.ilimRank !== undefined && (p.prof === 'hoca' || p.prof === 'hakim' || p.ilimRank === 0)) return ILIM_LABEL[p.ilimRank]!;
  return MAIN_LABEL[rankOf(p)];
}
/** Name with the rank in front for soldiers ('Çavuş Ahmet'); others get the rank after the name in the UI. */
export function displayName(_w: World, p: Person): string { if (p.prof === 'asker' && (p.askerRank ?? 1) >= 2) return `${ASKER_LABEL[p.askerRank!]} ${p.name.replace(/^Asker /, '')}`; return p.name; }
function setRank(w: World, p: Person, r: MainRank, why: string): void {
  const up = idx(r) > idx(rankOf(p)); p.yol = r;
  if (isPlayer(p) || idx(r) >= idx('usta')) log(w, `${up ? '⬆️' : '⬇️'} ${p.name} artık ${MAIN_LABEL[r]} (${why}).`, p.id);
  if (isPlayer(p)) tell(w, p, `${up ? '🎉 Yükseldiniz' : '⬇️ Düştünüz'}: ${MAIN_LABEL[r]}. ${why}.`);
}
export function demote(w: World, p: Person, n: number, why: string): void {
  if (p.id === w.kayzerId) return;
  if (p.prof === 'asker') { const r = (p.askerRank ?? 1) - n; if (r < 0) { expel(w, p, why); return; } p.askerRank = r; if (isPlayer(p)) tell(w, p, `⬇️ Rütbeniz düştü: ${ASKER_LABEL[r]} (${why}).`); log(w, `${p.name} ${ASKER_LABEL[r]} rütbesine düşürüldü (${why}).`, p.id); return; }
  const r = Math.max(0, idx(rankOf(p)) - n); if (p.soylu || p.rank) return; // titles are only taken by the Kayzer
  setRank(w, p, MAIN[r]!, why);
}
/** Bankruptcy: no money, no house and in debt → Dilenci. */
export function checkBankrupt(w: World, p: Person): void {
  if (p.id === w.kayzerId || p.soylu || rankOf(p) === 'dilenci') return;
  const house = w.buildings.some((b) => b.ownerId === p.id); const debt = (w.loans ?? []).some((l) => l.debtor === p.id);
  if (p.money < 1 && !house && debt) { setRank(w, p, 'dilenci', 'iflas: parasız, evsiz ve borçlu'); cs(p).notHungry = 0; }
}

// ---------------- requirements ----------------
export interface Req { label: string; have: number; need: number; ok: boolean }
const req = (label: string, have: number, need: number): Req => ({ label, have: Math.round(have * 10) / 10, need, ok: have >= need });
const owned = (w: World, p: Person): number => w.buildings.filter((b) => b.ownerId === p.id).length + (p.farm ? 1 : 0);
export function nextReqs(w: World, p: Person): { next: string; reqs: Req[]; approval?: string; reward: string } | null {
  const c = cs(p); const it = itibarOf(p);
  if (p.prof === 'asker') {
    const r = p.askerRank ?? 1; if (r >= 5) return null;
    const N = ASKER_LABEL[r + 1]!;
    if (r === 0) return { next: N, reqs: [req('Talim günleri', (c.talimDays ?? []).length, 2)], reward: 'Er maaşı, kışla yatağı ve sandık; nöbet, devriye, baskın.' };
    if (r === 1) return { next: N, reqs: [req('Hizmet günü', c.service ?? 0, 5), req('Baskın/savaş', c.raids ?? 0, 1), req('İtibar', it, 15)], reward: '4 kişilik manga, 1,3× maaş.' };
    if (r === 2) return { next: N, reqs: [req('Hizmet günü', c.service ?? 0, 10), req('Baskın/savaş', c.raids ?? 0, 3), req('Öldürme/yakalama', c.kills ?? 0, 5), req('İtibar', it, 30)], reward: 'Bölük talimi, 1,6× maaş.' };
    if (r === 3) return { next: N, reqs: [req('Kazanılan savunma', c.defenseWins ?? 0, 1), req('İtibar', it, 50), req('Okuma-yazma', c.literate ? 1 : 0, 1), req('Komutan tavsiyesi', c.rec || !komutanPlayer(w, p) ? 1 : 0, 1)], reward: '20 asker komuta, at alabilir, 2,5× maaş.' };
    return { next: N, reqs: [req('Kazanılan sefer', c.campaignWins ?? 0, 1), req('İtibar', it, 70)], approval: 'Kayzer ataması', reward: 'Bütün ordu, baskın savunması, Meclis’te savaş oyu; soyluluk için kahramanlık sayılır.' };
  }
  if (p.ilimRank !== undefined && p.ilimRank < 2 && (p.prof === 'hoca' || p.ilimRank === 0)) {
    if (p.ilimRank === 0) return { next: 'Hoca', reqs: [req('Okuma dersi', c.read ?? 0, 10), req('Dindarlık', p.din, 60), req('İtibar', it, 30)], reward: 'Okulda hoca maaşı, ders verme, vaaz.' };
    return { next: 'Kadı', reqs: [req('Verilen ders', c.taught ?? 0, 5), req('Dindarlık', p.din, 80), req('İtibar', it, 50)], approval: 'Kayzer ataması', reward: 'Mahkemede kadılık; soyluluk yolu açılır.' };
  }
  const r = rankOf(p);
  switch (r) {
    case 'dilenci': return { next: 'İşçi', reqs: [req('Aç kalmadan geçen gün', c.notHungry ?? 0, 3), req('Biriktirilen Dinar', p.money, 10)], reward: 'Gündelik ve çırak işleri, han odası.' };
    case 'isci': return { next: 'Çırak', reqs: [req('Bir ustanın yanında gün', c.ustaDays ?? 0, 3)], reward: 'Meslek becerisi; ustan itibar kazanır.' };
    case 'cirak': return { next: 'Usta', reqs: [req('Meslekte gün', c.jobDays ?? 0, 5), req('Dinar', p.money, 150), req('İtibar', it, 20), req('Lonca sınavı (kusursuz mal)', c.flawless ?? 0, 5)], reward: 'Dükkân, çırak alma hakkı, iş ilanı verme.' };
    case 'usta': return { next: 'Tüccar', reqs: [req('Dükkân', c.dukkan ? 1 : 0, 1), req('Dinar', p.money, 500), req('Başarılı ticaret', c.trades ?? 0, 10)], reward: 'Depo kiralama, kervana mal verme.' };
    case 'tuccar': return { next: 'Eşraf', reqs: [req('Ev sahibi', w.buildings.some((b) => b.ownerId === p.id && b.kind === 'ev') ? 1 : 0, 1)], reward: 'Meclis seçiminde oy ağırlığı, kira geliri, Meclis’e dilekçe.' };
    case 'esraf': return { next: 'Soylu', reqs: [req('Dinar', p.money, 2000), req('Mülk', owned(w, p), 2), req('İtibar', it, 60)], approval: 'Kayzer onayı (ya da savaş kahramanlığı)', reward: 'Ağa/Bey unvanı, saray hakları.' };
    case 'soylu': return { next: 'Kayzer’e danışman', reqs: [req('İtibar', it, 80)], approval: 'Kayzer ataması', reward: 'Divan’da danışmanlık.' };
    default: return null;
  }
}
function komutanPlayer(w: World, me: Person): Person | undefined { return w.people.find((x) => x !== me && x.prof === 'asker' && (x.askerRank ?? 0) >= 5 && isPlayer(x)); }

// ---------------- goals (2–3 multi-day goals per rank, paid by the saray) ----------------
export interface CGoal { id: string; text: string; have: (w: World, p: Person) => number; need: number; money: number; it: number }
export const CGOALS: Partial<Record<string, CGoal[]>> = {
  dilenci: [{ id: 'd-tok', text: '3 gün aç kalma', have: (_w, p) => cs(p).notHungry ?? 0, need: 3, money: 3, it: 2 }, { id: 'd-para', text: '10 Dinar biriktir', have: (_w, p) => p.money, need: 10, money: 2, it: 1 }],
  isci: [{ id: 'i-seri', text: '3 gün üst üste işe git', have: (_w, p) => cs(p).jobStreak ?? 0, need: 3, money: 5, it: 2 }, { id: 'i-siparis', text: 'Bir sipariş ilanını teslim et', have: (_w, p) => cs(p).quests ?? 0, need: 1, money: 6, it: 2 }, { id: 'i-usta', text: 'Bir ustanın yanında çalış (3 gün)', have: (_w, p) => cs(p).ustaDays ?? 0, need: 3, money: 4, it: 1 }],
  cirak: [{ id: 'c-gun', text: 'Meslekte 5 gün çalış', have: (_w, p) => cs(p).jobDays ?? 0, need: 5, money: 8, it: 2 }, { id: 'c-sinav', text: 'Lonca sınavı: 5 kusursuz mal', have: (_w, p) => cs(p).flawless ?? 0, need: 5, money: 10, it: 3 }, { id: 'c-sadaka', text: '5 Dinar sadaka ver', have: (_w, p) => cs(p).sadakaIt ?? 0, need: 1, money: 0, it: 1 }],
  usta: [{ id: 'u-ticaret', text: '10 başarılı ticaret', have: (_w, p) => cs(p).trades ?? 0, need: 10, money: 15, it: 3 }, { id: 'u-150', text: '300 Dinar biriktir', have: (_w, p) => p.money, need: 300, money: 10, it: 2 }],
  tuccar: [{ id: 't-ev', text: 'Bir ev satın al', have: (w, p) => w.buildings.filter((b) => b.ownerId === p.id && b.kind === 'ev').length, need: 1, money: 20, it: 3 }, { id: 't-liman', text: '20 başarılı ticaret', have: (_w, p) => cs(p).trades ?? 0, need: 20, money: 20, it: 2 }],
  esraf: [{ id: 'e-itibar', text: 'İtibarı 60’a çıkar', have: (_w, p) => itibarOf(p), need: 60, money: 30, it: 0 }, { id: 'e-mulk', text: '2 mülk edin', have: (w, p) => owned(w, p), need: 2, money: 30, it: 3 }],
  soylu: [{ id: 's-itibar', text: 'İtibarı 80’e çıkar', have: (_w, p) => itibarOf(p), need: 80, money: 40, it: 0 }],
  asker: [{ id: 'a-talim', text: '3 kez talim yap', have: (_w, p) => cs(p).talim ?? 0, need: 3, money: 3, it: 1 }, { id: 'a-nobet', text: '5 gün nöbet tut', have: (_w, p) => cs(p).service ?? 0, need: 5, money: 8, it: 2 }, { id: 'a-baskin', text: 'Bir baskında savaş', have: (_w, p) => cs(p).raids ?? 0, need: 1, money: 10, it: 2 }],
  ilim: [{ id: 'l-oku', text: '5 okuma dersi', have: (_w, p) => cs(p).read ?? 0, need: 5, money: 4, it: 2 }, { id: 'l-cuma', text: 'Cuma namazına katıl', have: (_w, p) => (cs(p).cumaDay ? 1 : 0), need: 1, money: 2, it: 1 }],
};
export function goalsFor(p: Person): CGoal[] { const key = p.prof === 'asker' ? 'asker' : p.ilimRank !== undefined && p.ilimRank < 2 ? 'ilim' : rankOf(p); return CGOALS[key] ?? []; }
function payGoals(w: World, p: Person): void {
  const g = (cs(p).goals ??= {});
  for (const x of goalsFor(p)) if (!g[x.id] && x.have(w, p) >= x.need) {
    g[x.id] = true; if (x.money > 0 && w.treasury > 500) transfer(w, 'saray', p.id, x.money, `hedef ödülü (${x.text})`); if (x.it) itibar(w, p, x.it, `hedef: ${x.text}`);
    if (isPlayer(p)) tell(w, p, `🎯 Hedef tamam: ${x.text} (+${x.money} D, +${x.it} itibar)`);
  }
}

// ---------------- daily promotion check ----------------
export function careerDay(w: World): void {
  migrateCareer(w);
  for (const p of w.people) {
    if (!isPlayer(p)) continue; const c = cs(p);
    c.notHungry = p.hunger < 85 && p.meals > 0 ? (c.notHungry ?? 0) + 1 : 0;
    if (p.prof === 'asker') c.service = (c.service ?? 0) + (p.job?.attDay === w.day ? 1 : 0);
    checkBankrupt(w, p); payGoals(w, p); promote(w, p);
  }
}
export function promote(w: World, p: Person): void {
  const n = nextReqs(w, p); if (!n || !n.reqs.every((r) => r.ok)) return;
  if (p.prof === 'asker') {
    const r = (p.askerRank ?? 1) + 1; if (n.approval) { askApproval(w, p, 'komutan', `${p.name} Komutanlığa hazır (sefer zaferi, itibar ${Math.round(itibarOf(p))}).`); return; }
    p.askerRank = r; log(w, `🎖 ${p.name} terfi etti: ${ASKER_LABEL[r]}.`, p.id); if (isPlayer(p)) tell(w, p, `🎖 Terfi! Artık ${ASKER_LABEL[r]}sınız. Maaş ${ASKER_WAGE[r]}×.`); if (p.job) p.job.wage = soldierWage(w, r); return;
  }
  if (p.ilimRank !== undefined && (p.ilimRank === 0 || p.prof === 'hoca')) {
    if (p.ilimRank === 0) { p.ilimRank = 1; p.prof = 'hoca'; p.work = 'okul'; p.job = stateJob(w, 'hoca', 'Okul hocası', 'okul'); log(w, `📚 ${p.name} hoca oldu.`, p.id); if (isPlayer(p)) tell(w, p, '📚 Tebrikler, artık Hoca’sınız: okulda maaş alır, ders verirsiniz.'); return; }
    askApproval(w, p, 'kadi', `${p.name} kadılığa hazır (din ${Math.round(p.din)}, itibar ${Math.round(itibarOf(p))}).`); return;
  }
  const r = rankOf(p); const next = MAIN[idx(r) + 1]; if (!next) return;
  if (next === 'soylu') { askApproval(w, p, 'soylu', `${p.name} soyluluk istiyor: ${Math.round(p.money)} D, ${owned(w, p)} mülk, itibar ${Math.round(itibarOf(p))}.`); return; }
  if (next === 'danisman') { askApproval(w, p, 'danisman', `${p.name} Kayzer’e danışman olmak istiyor (itibar ${Math.round(itibarOf(p))}).`); return; }
  setRank(w, p, next, 'şartlar tamam');
  if (next === 'usta') { cs(p).dukkan = true; }
}
function askApproval(w: World, p: Person, what: string, text: string): void {
  if (w.petitions.some((x) => x.fromId === p.id && x.kind === 'unvan' && x.status === 'bekliyor')) return;
  if ((cs(p).noted?.[what] ?? -99) > w.day - 3) return; (cs(p).noted ??= {})[what] = w.day;
  w.petitions.push({ id: nextId(w, 'D'), fromId: p.id, kind: 'unvan', text, day: w.day, expires: w.day + 3, status: 'bekliyor', amount: 0, payload: what });
  if (isPlayer(p)) tell(w, p, `📜 Şartları tamamladınız; ${what === 'komutan' ? 'Komutanlık' : what === 'kadi' ? 'Kadılık' : what === 'soylu' ? 'soyluluk' : 'danışmanlık'} için Kayzer’in onayı bekleniyor.`);
}
/** Kayzer accepted an 'unvan' petition. */
export function approve(w: World, p: Person, what: string): boolean {
  if (what === 'komutan' && p.prof === 'asker') { p.askerRank = 5; if (p.job) p.job.wage = soldierWage(w, 5); log(w, `🎖 ${p.name} Komutan (sancakbeyi) oldu.`, p.id); return true; }
  if (what === 'kadi') { p.ilimRank = 2; p.prof = 'hakim'; p.work = WORKPLACE.hakim; p.job = stateJob(w, 'hakim', 'Kadı', 'mahkeme'); log(w, `⚖️ ${p.name} kadı oldu.`, p.id); return true; }
  if (what === 'soylu') { p.soylu = true; p.rank ??= 'Ağa'; p.yol = 'soylu'; log(w, `👑 ${p.name} soylu oldu (Ağa).`, p.id); return true; }
  if (what === 'danisman') { p.yol = 'danisman'; (w.advisors ??= []).push(p.id); log(w, `📜 ${p.name} Kayzer’e danışman oldu.`, p.id); return true; }
  return false;
}

// ---------------- jobs ----------------
export const soldierWage = (w: World, r: number): number => Math.round((w.salaries.asker ?? 7) * ASKER_WAGE[r]! * 100) / 100;
function stateJob(w: World, prof: Profession, title: string, place: string): Job { return { id: nextId(w, 'J'), title, place, prof, wage: w.salaries[prof] ?? 7, from: 8, to: 16, employerId: 'saray', kind: 'devlet' }; }
export const hoursText = (j: Job): string => `${String(j.from).padStart(2, '0')}–${String(j.to % 24).padStart(2, '0')}`;
export function reqText(j: Job): string { const r = j.req ?? {}; const t = [r.rank ? MAIN_LABEL[r.rank] : '', r.itibar ? `itibar ${r.itibar}` : '', r.din ? `din ${r.din}` : '', r.literate ? 'okuma-yazma' : ''].filter(Boolean); return t.length ? `şart: ${t.join(', ')}` : 'şart yok'; }
export function meetsReq(w: World, p: Person, j: Job): string | null {
  const r = j.req ?? {};
  if (r.rank && idx(rankOf(p)) < idx(r.rank)) return `Önce ${MAIN_LABEL[r.rank]} olmalısınız (şimdi ${MAIN_LABEL[rankOf(p)]}).`;
  if (r.itibar && itibarOf(p) < r.itibar) return `İtibarınız yetmiyor (${Math.round(itibarOf(p))}/${r.itibar}).`;
  if (r.din && p.din < r.din) return `Dindarlığınız yetmiyor (${Math.round(p.din)}/${r.din}).`;
  if (r.literate && !cs(p).literate) return 'Okuma-yazma gerekiyor (Okul’da ders alın).';
  if (yearsOf(w, p) < 16) return '16 yaşından küçükler çalışamaz.';
  return null;
}
/** Rebuild the İş İlanı Tahtası each morning (players' own notices are kept). */
export function refreshJobs(w: World): void {
  const keep = (w.jobs ?? []).filter((j) => j.kind === 'oyuncu' && findPerson(w, j.employerId));
  const m = wageMul(w); const r2 = (x: number): number => Math.round(x * m * 100) / 100;
  const list: Job[] = [
    { id: 'J-hamal', title: 'Liman hamallığı (gündelik)', place: 'liman', prof: 'hamal', wage: r2(3), from: 6, to: 14, employerId: 'dis', kind: 'gundelik' },
    { id: 'J-irgat', title: 'Tarla ırgatlığı (gündelik)', place: 'ciftlik', prof: 'hamal', wage: r2(3), from: 6, to: 14, employerId: 'saray', kind: 'gundelik' },
  ];
  const seen = new Set<string>();
  for (const u of w.people) {
    const spec = PRODUCES[u.prof]; if (!spec || u.playerId || u.xp < 60 || u.money < 40 || u.jailedDays > 0 || seen.has(u.prof)) continue; seen.add(u.prof);
    const place = WORKPLACE[u.prof]; const bn = w.buildings.find((b) => b.id === place)?.name ?? place;
    list.push({ id: `J-c-${u.prof}`, title: `${bn}, çırak (usta: ${u.name})`, place, prof: u.prof, wage: r2(4), from: 6, to: 14, employerId: u.id, kind: 'cirak' });
    list.push({ id: `J-u-${u.prof}`, title: `${PROF_LABEL[u.prof]} (kendi tezgâhın)`, place, prof: u.prof, wage: 0, from: 8, to: 16, employerId: '-', kind: 'usta', req: { rank: 'usta' } });
  }
  list.push({ ...stateJob(w, 'bekci', 'Bekçi', 'zindan'), id: 'J-bekci', req: { itibar: 20 } });
  list.push({ ...stateJob(w, 'memur', 'Memur (Saray)', 'saray'), id: 'J-memur', req: { itibar: 25, literate: true } });
  list.push({ ...stateJob(w, 'tahsildar', 'Tahsildar', 'kahve'), id: 'J-tahsildar', req: { itibar: 35, literate: true } });
  w.jobs = [...list, ...keep];
}
/** Hire p into a job (board 'Başvur', 'Bir iş var mı?' or köken). */
export function hire(w: World, p: Person, j: Job): string | null {
  const e = meetsReq(w, p, j); if (e) return e;
  if (p.prof === 'asker') return 'Askerken başka işte çalışamazsınız; önce terhis olun.';
  if (j.kind === 'cirak' && j.employerId === p.id) return 'Kendinize çırak olamazsınız.';
  const job: Job = { ...j, id: nextId(w, 'J'), att: 0, hiredDay: w.day };
  if (j.prof && j.kind !== 'cirak') { p.prof = j.prof; p.work = WORKPLACE[j.prof] ?? j.place; }
  if (j.kind === 'cirak') { p.work = j.place; cs(p).ustaId = j.employerId; }
  if (j.kind === 'gundelik') p.work = j.place;
  p.job = job; p.unemployedDays = 0; { const c = cs(p); c.missStreak = 0; c.offStreak = 0; } // v2.0.3: a new job starts with a clean slate (old misses fired players on their first miss)
  if (j.kind === 'oyuncu') w.jobs = (w.jobs ?? []).filter((x) => x.id !== j.id);
  log(w, `💼 ${p.name} işe girdi: ${j.title} (${hoursText(j)}, günde ${j.wage} D).`, p.id);
  return null;
}
export function quitJob(w: World, p: Person): string { if (!p.job) return 'İşiniz yok.'; if (p.prof === 'asker') return 'Askerlikten ayrılmak için Kışla’da “Terhis”.'; const t = p.job.title; p.job = undefined; log(w, `${p.name} işten ayrıldı (${t}).`, p.id); return `${t} işinden ayrıldınız. İş İlanı Tahtası’ndan yeni iş seçebilirsiniz.`; }
/** Usta/tüccar players post a notice; the wage comes out of their purse each worked day. */
export function postJob(w: World, p: Person, title: string, wage: number, from: number, to: number): string | null {
  if (idx(rankOf(p)) < idx('usta')) return 'İş ilanını ancak usta ya da tüccar verebilir.';
  if (p.money < wage * 3) return `Üç günlük ücret (${wage * 3} D) kesenizde olmalı.`;
  if ((w.jobs ?? []).filter((j) => j.employerId === p.id).length >= 2) return 'En fazla 2 açık ilanınız olabilir.';
  (w.jobs ??= []).push({ id: nextId(w, 'J'), title: `${title.slice(0, 40)} (${p.name})`, place: p.work, prof: p.prof, wage, from, to, employerId: p.id, kind: 'oyuncu' });
  log(w, `📌 ${p.name} iş ilanı astı: ${title} – günde ${wage} D (${String(from).padStart(2, '0')}–${String(to).padStart(2, '0')}).`, p.id); return null;
}
/** Etkileşim 'Bir iş var mı?' with a shop owner. */
export function askJob(w: World, me: Person, t: Person): { ok: boolean; msg: string } {
  const spec = PRODUCES[t.prof]; const it = itibarOf(me);
  if (t.prof === 'barci' && me.din >= 70) return { ok: false, msg: `${t.name}: “Sen cami kuşusun, meyhanede ne işin var?”` };
  const pious = t.din >= 70 && me.din >= 60;
  if (it < (pious ? 3 : 5)) return { ok: false, msg: `${t.name}: “Adın kötüye çıkmış; önce itibarını düzelt.”` };
  if (!spec || STATE.includes(t.prof)) return { ok: false, msg: `${t.name}: “Bende iş yok; Pazar’daki İş İlanı Tahtası’na bak.”` };
  if (rankOf(me) === 'dilenci' && !pious) return { ok: false, msg: `${t.name}: “Önce gündelik bir işte çalış, sonra gel.”` };
  if (idx(rankOf(me)) >= idx('usta')) return { ok: false, msg: `${t.name}: “Sen zaten ustasın, kendi tezgâhını aç.”` };
  if (t.xp < 60) return { ok: false, msg: `${t.name}: “Ben de daha kalfayım; çırak alamam. Bir ustaya sor.”` };
  if (t.money < 20) return { ok: false, msg: `${t.name}: “Kesem boş, ücret veremem.”` };
  const place = WORKPLACE[t.prof];
  const e = hire(w, me, { id: '-', title: `${w.buildings.find((b) => b.id === place)?.name ?? place}, çırak (usta: ${t.name})`, place, prof: t.prof, wage: Math.round((pious ? 5 : 4) * wageMul(w) * 100) / 100, from: 6, to: 14, employerId: t.id, kind: 'cirak' });
  if (e) return { ok: false, msg: `${t.name}: “${e}”` };
  return { ok: true, msg: `${t.name}: “Olur, yarın sabah 06:00’da ${w.buildings.find((b) => b.id === place)?.name ?? place}’da ol. Önce çıraklık yap.”` };
}
const inShift = (j: Job, h: number): boolean => (j.from <= j.to ? h >= j.from && h < j.to : h >= j.from || h < j.to);
const shiftLen = (j: Job): number => (j.to - j.from + 24) % 24 || 24;
/** Hourly: count attendance (player near the workplace during his shift); at the end of the shift pay or punish. */
export function careerHour(w: World, now: number): void {
  for (const p of w.people) {
    const j = p.job; if (!j || !isPlayer(p)) continue;
    if (!isSoldierJob(p, j)) { // v2.0.3: civilian jobs are paid by İş görevi (3 a day, any hour of the day)
      if (j.hiredDay === undefined) { j.hiredDay = w.day; cs(p).missStreak = 0; } // jobs from before v2.0.3: clean slate + today is a grace day
      if (w.hour === 0) taskDayEnd(w, p, j, w.day - 1); // online that day but < 3 tasks → a missed day
      const on = isOnline(w, p.playerId, now, 120_000); if (on) j.onlineDay = w.day;
      // never came online during the shift → the old "absent" rule (offStreak; 3 → the job ends), judged at the shift's end
      if (j.attDay !== w.day && w.hour === j.from) { j.attDay = w.day; j.online = false; }
      if (inShift(j, w.hour) && j.attDay === w.day && on) j.online = true;
      if (w.hour === j.to % 24 && j.attDay !== undefined && (w.day === j.attDay || (j.from > j.to && w.day === j.attDay + 1))) {
        const d = j.attDay; j.attDay = undefined;
        if (!j.online && j.paidDay !== d && j.onlineDay !== d && j.judgedDay !== d) { j.judgedDay = d; missDay(w, p, j, false); }
      }
      continue;
    }
    if (j.attDay !== w.day && w.hour === j.from) { j.att = 0; j.attDay = w.day; j.online = false; }
    if (inShift(j, w.hour) && j.attDay === w.day) {
      const on = isOnline(w, p.playerId, now, 120_000); if (on) j.online = true;
      const b = w.buildings.find((x) => x.id === j.place); if (on && b && distToBuilding(b, myPos(w, p, now)) <= REACH + 1) j.att = (j.att ?? 0) + 1;
    }
    if (w.hour === j.to % 24 && j.attDay !== undefined && (w.day === j.attDay || (j.from > j.to && w.day === j.attDay + 1))) endShift(w, p, j);
  }
}
/** v2.0.3: the end of a game day for a civilian job: 3 tasks done (paid already) or a missed day. */
function taskDayEnd(w: World, p: Person, j: Job, day: number): void {
  if (j.paidDay === day || (j.hiredDay ?? -1) >= day || j.judgedDay === day || j.onlineDay !== day) return; // offline days are judged at the shift's end
  j.judgedDay = day; missDay(w, p, j, true);
}
/** Full day's pay: wage from the employer, +1 itibar, streaks, çırak/dilenci progress. */
export function payDay(w: World, p: Person, j: Job): void { workedDay(w, p, j); }
function workedDay(w: World, p: Person, j: Job): void {
  const c = cs(p);
  {
    c.missStreak = 0; c.offStreak = 0; c.jobDays = (c.jobDays ?? 0) + 1; c.jobStreak = (c.jobStreak ?? 0) + 1;
    if (j.wage > 0 && j.employerId !== '-') { const payer = j.employerId; if (!transfer(w, payer, p.id, j.wage, `ücret (${j.title})`)) { tell(w, p, `💸 ${findPerson(w, payer)?.name ?? 'İşvereniniz'} ücretinizi ödeyemedi; iş bitti.`); p.job = undefined; } else p.incomeToday += j.wage; }
    itibar(w, p, 1, 'tam bir iş günü');
    if (j.kind === 'cirak') { c.ustaDays = (c.ustaDays ?? 0) + 1; const u = findPerson(w, j.employerId); if (u) { u.itibar = clamp(itibarOf(u) + 0.5, 0, 100); if (isPlayer(u)) itibar(w, u, 1, `çırağınız ${p.name} bir gün çalıştı`); } if (rankOf(p) === 'isci' && c.ustaDays >= 3) promote(w, p); }
    if (rankOf(p) === 'dilenci' && (c.jobDays ?? 0) >= 2) { /* dilenci → işçi needs the dilenci goal; 2 days in a job also counts */ setRank(w, p, 'isci', '2 gün bir işte çalıştı'); }
    j.attDay = undefined;
  }
}
function endShift(w: World, p: Person, j: Job): void {
  const done = (j.att ?? 0) >= Math.ceil(shiftLen(j) / 2);
  if (done) { workedDay(w, p, j); return; }
  missDay(w, p, j, !!j.online);
}
function missDay(w: World, p: Person, j: Job, online: boolean): void {
  const c = cs(p);
  c.jobStreak = 0;
  if (!online) { c.offStreak = (c.offStreak ?? 0) + 1; if (c.offStreak >= 3) { p.job = undefined; itibar(w, p, -2, 'üç gündür işe gelmedi, kovuldu'); } j.attDay = undefined; return; }
  c.missStreak = (c.missStreak ?? 0) + 1; itibar(w, p, -2, `işe gelmedi (${j.title})`);
  if (p.prof === 'asker') demote(w, p, 1, 'nöbeti terk etti');
  else if (c.missStreak >= 2) { p.job = undefined; itibar(w, p, -3, 'kovuldu'); tell(w, p, `🚪 İki gündür işe gelmediğiniz için ${j.title} işinden kovuldunuz.`); }
  j.attDay = undefined;
}

// ---------------- asker ----------------
export function enlist(w: World, p: Person, volunteer = true): string | null {
  if (yearsOf(w, p) < 16) return 'Askerlik 16 yaşından itibaren.';
  if (p.prof === 'asker') return 'Zaten askersiniz.'; if (p.id === w.kayzerId) return 'Kayzer ordunun başıdır.';
  if (itibarOf(p) < 0) return 'Sabıkalılar alınmaz.';
  (p.cs ??= {}).noted = { ...(p.cs.noted ?? {}), mainRank: idx(rankOf(p)) };
  p.prof = 'asker'; p.work = 'kisla'; p.askerRank = 0; p.job = { id: nextId(w, 'J'), title: 'Acemi er (talim)', place: 'kisla', prof: 'asker', wage: soldierWage(w, 0), from: 6, to: 14, employerId: 'saray', kind: 'asker' };
  log(w, `🪖 ${p.name} ${volunteer ? 'gönüllü olarak' : 'seferberlikle'} orduya katıldı (Acemi er).`, p.id); return null;
}
export function discharge(w: World, p: Person): string | null {
  if (p.prof !== 'asker') return 'Asker değilsiniz.'; if (w.combat || w.raid?.phase === 'gece') return 'Savaş sürerken terhis olunmaz!';
  p.prof = 'hamal'; p.work = 'pazar'; p.job = undefined; p.askerRank = undefined; log(w, `${p.name} terhis oldu; ana yola döndü (${MAIN_LABEL[rankOf(p)]}).`, p.id); return null;
}
export function expel(w: World, p: Person, why: string): void { p.prof = 'hamal'; p.work = 'pazar'; p.job = undefined; p.askerRank = undefined; log(w, `🚫 ${p.name} ordudan atıldı (${why}).`, p.id); if (isPlayer(p)) tell(w, p, `🚫 Ordudan atıldınız: ${why}.`); }
/** Talim at the kışla: 1 game hour, energy cost, combat skill. */
export function talim(w: World, p: Person): string | null {
  const c = cs(p); const key = w.day * 24 + w.hour; if (c.talimAt === key) return 'Bu saat zaten talim yaptınız; bir sonraki saati bekleyin.';
  if ((p.energy ?? 80) < 15) return 'Çok yorgunsunuz; önce dinlenin.';
  c.talimAt = key; c.talim = (c.talim ?? 0) + 1; c.skill = Math.min(20, (c.skill ?? 0) + 1); p.energy = clamp((p.energy ?? 80) - 12);
  const days = (c.talimDays ??= []); if (!days.includes(w.day)) days.push(w.day); if (days.length > 10) days.shift();
  if (p.prof === 'asker') promote(w, p); return null;
}
/** Combat skill bonus from talim (up to +20%). */
export const skillMul = (p: Person): number => 1 + Math.min(20, p.cs?.skill ?? 0) / 100;
export function setShift(w: World, p: Person, shift: 'gunduz' | 'aksam' | 'gece'): string | null {
  if (p.prof !== 'asker' || !p.job) return 'Önce Kışla’da kayıt olun.'; if ((p.askerRank ?? 0) === 0) return 'Acemi erler önce talim yapar (06–14).';
  const [f, t] = shift === 'gunduz' ? [6, 14] : shift === 'aksam' ? [14, 22] : [22, 6]; p.job.from = f; p.job.to = t; p.job.title = `Nöbet (${shift === 'gunduz' ? 'gündüz' : shift === 'aksam' ? 'akşam' : 'gece'})`; p.job.wage = soldierWage(w, p.askerRank ?? 1); return null;
}
/** Fighting record: called when a raid/war ends. fighters = person ids that attacked; won = city won. */
export function combatRecord(w: World, kind: 'raid' | 'war', fighters: string[], killers: Record<string, number>, won: boolean, onlineSoldiers: string[]): void {
  for (const id of fighters) { const p = findPerson(w, id); if (!p) continue; const c = cs(p); c.raids = (c.raids ?? 0) + 1 + ((killers[id] ?? 0) > 0 ? 1 : 0); c.kills = (c.kills ?? 0) + (killers[id] ?? 0);
    if (won) { if (kind === 'raid') c.defenseWins = (c.defenseWins ?? 0) + 1; else c.campaignWins = (c.campaignWins ?? 0) + 1; }
    itibar(w, p, 5, kind === 'raid' ? 'baskında savaştı' : 'savaşta çarpıştı'); promote(w, p); }
  for (const id of onlineSoldiers) if (!fighters.includes(id)) { const p = findPerson(w, id); if (p && p.prof === 'asker' && isPlayer(p)) { cs(p).fled = (cs(p).fled ?? 0) + 1; demote(w, p, 2, 'baskından kaçtı'); } }
}
export function seferberlik(w: World, on: boolean): string {
  w.seferberlik = on ? w.day : 0; if (!on) { log(w, 'Ferman: seferberlik bitti.'); return 'Seferberlik kaldırıldı.'; }
  const pool = w.people.filter((p) => !p.playerId && (p.prof === 'hamal' || p.unemployedDays > 2) && yearsOf(w, p) >= 16 && yearsOf(w, p) < 50 && !p.female).slice(0, 6);
  for (const p of pool) { enlist(w, p, false); p.askerRank = 1; }
  for (const pl of Object.values(w.players)) personal(w, pl.playerId, `📯 SEFERBERLİK! Kayzer orduyu topluyor; ${pool.length} kişi askere alındı. 16 yaşından büyükler Kışla’daki kayıt subayına gönüllü yazılabilir.`);
  log(w, `📯 Ferman: SEFERBERLİK! ${pool.length} kişi askere alındı.`); return `Seferberlik ilan edildi (${pool.length} kişi askere alındı).`;
}

// ---------------- din-ilim ----------------
export function becomeTalebe(w: World, p: Person): string | null { if (p.din < 30) return `Talebe olmak için dindarlık 30 gerekir (şimdi ${Math.round(p.din)}).`; if (p.ilimRank !== undefined) return 'Zaten ilim yolundasınız.'; if (p.prof === 'asker') return 'Askerken talebe olunmaz.'; p.ilimRank = 0; log(w, `📖 ${p.name} talebe oldu.`, p.id); return null; }
/** A lesson at the okul (max 3 a day): reading counts toward okuma-yazma and the ilim path. */
export function readLesson(w: World, p: Person): string | null {
  const c = cs(p); if (c.readDay !== w.day) { c.readDay = w.day; c.readToday = 0; } if ((c.readToday ?? 0) >= 3) return 'Bugün yeterince ders aldınız.';
  const fee = p.ilimRank === 0 ? 0 : 1; if (fee && !transfer(w, p.id, findPerson(w, w.people.find((x) => x.prof === 'hoca')?.id)?.id ?? 'saray', fee, 'okuma dersi')) return 'Ders ücreti 1 D.';
  c.readToday = (c.readToday ?? 0) + 1; c.read = (c.read ?? 0) + 1; if (c.read >= 3 && !c.literate) { c.literate = true; if (isPlayer(p)) tell(w, p, '📖 Artık okuma-yazma biliyorsunuz.'); }
  p.din = clamp(p.din + 0.5); promote(w, p); return null;
}
export function teach(w: World, p: Person): string | null { if (p.prof !== 'hoca') return 'Ders vermek için hoca olmalısınız.'; const c = cs(p); const key = w.day; if (c.readDay === key && (c.readToday ?? 0) >= 9) return 'Bugün yeterince ders verdiniz.'; c.taught = (c.taught ?? 0) + 1; itibar(w, p, 1, 'okulda ders verdi'); promote(w, p); return null; }

// ---------------- migration of existing players ----------------
export function migrateCareer(w: World): void {
  if ((w.careerV ?? 0) >= 1) return; w.careerV = 1;
  for (const p of w.people) {
    p.itibar ??= Math.round(clamp(ITIBAR_START + (p.rep ?? 0) / 2 + (p.soylu ? 30 : 0) + (p.meclis ? 15 : 0), 0, 100));
    if (p.yol) continue;
    const house = w.buildings.some((b) => b.ownerId === p.id && b.kind === 'ev');
    p.yol = p.soylu || p.rank ? 'soylu' : house && p.money >= 300 ? 'esraf' : p.prof === 'tuccar' && p.money >= 300 ? 'tuccar' : PRODUCES[p.prof] && p.xp >= 60 ? 'usta' : PRODUCES[p.prof] && p.xp >= 20 ? 'cirak' : 'isci';
    if (p.prof === 'asker') p.askerRank = p.xp >= 60 ? 3 : p.xp >= 20 ? 2 : 1;
    if (p.prof === 'hoca' || p.prof === 'imam') p.ilimRank = 1; if (p.prof === 'hakim') p.ilimRank = 2;
    if (isPlayer(p) && !p.job) p.job = ownJob(w, p);
    if (p.yol === 'usta' || p.yol === 'tuccar' || p.yol === 'esraf') cs(p).dukkan = true;
  }
}
/** The job a citizen already has (köken / existing meslek): self-employed producers and state servants. */
export function ownJob(w: World, p: Person): Job | undefined {
  if (p.prof === 'kayzer' || p.prof === 'naip') return undefined;
  if (p.prof === 'asker') return { id: nextId(w, 'J'), title: 'Nöbet (gündüz)', place: 'kisla', prof: 'asker', wage: soldierWage(w, p.askerRank ?? 1), from: 6, to: 14, employerId: 'saray', kind: 'asker' };
  if (STATE.includes(p.prof)) return stateJob(w, p.prof, PROF_LABEL[p.prof], WORKPLACE[p.prof]);
  if (p.prof === 'hamal') return { id: nextId(w, 'J'), title: 'Liman hamallığı (gündelik)', place: 'liman', prof: 'hamal', wage: Math.round(3 * wageMul(w) * 100) / 100, from: 6, to: 14, employerId: 'dis', kind: 'gundelik' };
  return { id: nextId(w, 'J'), title: `${PROF_LABEL[p.prof]} (kendi işin)`, place: WORKPLACE[p.prof], prof: p.prof, wage: 0, from: 8, to: 16, employerId: '-', kind: 'kendi' };
}
