/**
 * v2.0.3 İş görevi: short themed tasks at the workplace replace "stand at work for half the shift".
 * 3 tasks in a game day (any hour of that day, at the workplace) = the day's wage (+1 itibar, streaks, çırak/dilenci progress).
 * A task can't be finished in under 15 real seconds; finishing quickly (≤ 25 s) earns a small bahşiş from a customer.
 * Soldiers keep the kışla attendance system (careerHour).
 */
import type { Job, Person, Profession, World } from './types';
import { distToBuilding, REACH } from './move';
import { myPos } from './v16';
import { transfer } from './economy';

export const TASKS_PER_DAY = 3;
export const TASK_MIN_MS = 15_000;   // server: no faster than this
export const TASK_MAX_MS = 180_000;  // an abandoned task expires
export const TASK_FAST_MS = 25_000;  // finished within → bahşiş
export interface TaskDef { name: string; steps: [string, string, string] }

const BY_PROF: Partial<Record<Profession, TaskDef>> = {
  barci: { name: 'Müşteriye servis', steps: ['📝 Sipariş al', '🍺 İçki doldur', '🍽 Masaya servis et'] },
  firinci: { name: 'Ekmek pişir', steps: ['🫓 Hamuru yoğur', '🔥 Fırına koy', '🥖 Fırından çıkar'] },
  demirci: { name: 'Nal dövme', steps: ['🔥 Demiri ısıt', '🔨 Örste döv', '💧 Suda soğut'] },
  terzi: { name: 'Kaftan dik', steps: ['📏 Ölçü al', '✂️ Kumaşı kes', '🪡 Dik'] },
  marangoz: { name: 'Sandık yap', steps: ['🪚 Tahtayı kes', '🔨 Çivile', '🪵 Zımparala'] },
  ciftci: { name: 'Tarla işi', steps: ['🌱 Tohum ek', '💧 Sula', '🌾 Hasat et'] },
  hamal: { name: 'Yük taşı', steps: ['📦 Yükü sırtla (A)', '🚶 Pazarın öbür ucuna taşı', '📍 Teslim et (B)'] },
  balikci: { name: 'Liman işi', steps: ['⚓ Halatı çöz', '🐟 Ağı çek', '📦 Balığı sandığa koy'] },
  sucu: { name: 'Su taşı', steps: ['🪣 Kovayı indir', '💪 Kovayı çek', '🏺 Testileri doldur'] },
  kasap: { name: 'Et hazırla', steps: ['🔪 Eti ayır', '⚖️ Tart', '📦 Paketle'] },
  hekim: { name: 'Hasta bak', steps: ['🩺 Hastayı dinle', '🌿 Merhem hazırla', '🩹 Sargıyı sar'] },
  hoca: { name: 'Ders ver', steps: ['📖 Dersi anlat', '✍️ Ödevleri gör', '🔔 Dersi bitir'] },
  insaatci: { name: 'Duvar ör', steps: ['🧱 Tuğla taşı', '🪣 Harç karıştır', '🧱 Sırayı ör'] },
  kalemsor: { name: 'Kahvehane işi', steps: ['☕ Kahveyi kavur', '🫖 Cezvede pişir', '🍽 Masaya götür'] },
  imam: { name: 'Cami hizmeti', steps: ['🧹 Avluyu süpür', '💧 Şadırvanı doldur', '📿 Vakti bildir'] },
  hayvanci: { name: 'Ahır işi', steps: ['🌾 Yem ver', '🐄 Süt sağ', '🧹 Ahırı temizle'] },
  degirmenci: { name: 'Un öğüt', steps: ['🌾 Buğdayı dök', '⚙️ Taşı çevir', '🛍 Unu çuvalla'] },
  dokumaci: { name: 'Kumaş doku', steps: ['🧶 İpliği ger', '🪡 Mekiği at', '🧵 Kumaşı katla'] },
  mobilyaci: { name: 'Mobilya yap', steps: ['🪚 Kes', '🔨 Birleştir', '🎨 Cilala'] },
  tuccar: { name: 'Tezgâh işi', steps: ['📦 Malları diz', '🗣 Pazarlık et', '💰 Satışı yaz'] },
  memur: { name: 'Dilekçe işle', steps: ['📜 Dilekçeyi al', '🖋 Deftere kaydet', '📮 Mühürle'] },
  tahsildar: { name: 'Vergi defteri', steps: ['📒 Defteri aç', '🧮 Hesapla', '🖋 İmzala'] },
  bekci: { name: 'Zindan nöbeti', steps: ['🔦 Hücrelere bak', '🗝 Kapıları kilitle', '📋 Nöbet defterine yaz'] },
  savci: { name: 'Dosya hazırla', steps: ['📂 Dosyayı aç', '🔎 Delilleri incele', '🖋 İddianame yaz'] },
  hakim: { name: 'Dosya incele', steps: ['📂 Dosyayı aç', '⚖️ Tart', '🖋 Karar yaz'] },
};
const BY_PLACE: Record<string, TaskDef> = {
  bar: BY_PROF.barci!, firin: BY_PROF.firinci!, ciftlik: BY_PROF.ciftci!, liman: { name: 'Liman işi', steps: ['⚓ Halatı çöz', '📦 Sandığı indir', '🚶 Ambara taşı'] },
};
const GENERIC: TaskDef = { name: 'Günlük iş', steps: ['🧰 Hazırlan', '💪 Çalış', '✅ İşi bitir'] };
/** The task you get at this job (profession first, then the workplace, then a generic one). */
export function taskFor(j: Job, p: Person): TaskDef { return (j.prof && BY_PROF[j.prof]) || BY_PROF[p.prof] || BY_PLACE[j.place] || GENERIC; }
export const isSoldierJob = (p: Person, j: Job): boolean => p.prof === 'asker' || j.kind === 'asker';
export function tasksToday(w: World, j: Job | undefined): number { return j && j.taskDay === w.day ? j.tasks ?? 0 : 0; }

export interface TaskResult { ok: boolean; msg: string; tasks?: number; paid?: boolean; tip?: number }
/** start / done. `payDay` is career.ts's full-day payment (wage, +1 itibar, streaks, çırak/dilenci). */
export function jobTask(w: World, p: Person, step: 'start' | 'done', now: number, payDay: (w: World, p: Person, j: Job) => void): TaskResult {
  const j = p.job; if (!j) return { ok: false, msg: 'İşiniz yok. Pazar’daki İş İlanı Tahtası’na bakın.' };
  if (isSoldierJob(p, j)) return { ok: false, msg: 'Askerler Kışla’da talim ve nöbetle çalışır (vardiyada kışlada olun).' };
  const b = w.buildings.find((x) => x.id === j.place);
  if (!b || distToBuilding(b, myPos(w, p, now)) > REACH + 1) return { ok: false, msg: `İş görevi iş yerinde yapılır: ${b?.name ?? j.place}’a gidin.` };
  if (j.taskDay !== w.day) { j.taskDay = w.day; j.tasks = 0; j.taskAt = undefined; }
  j.onlineDay = w.day;
  const t = taskFor(j, p);
  if (step === 'start') {
    if ((j.tasks ?? 0) >= TASKS_PER_DAY) return { ok: false, msg: `Bugünkü ${TASKS_PER_DAY} görev tamam, ücretinizi aldınız. Yarın yine gelin.`, tasks: j.tasks };
    j.taskAt = now; return { ok: true, msg: `🛠 ${t.name} başladı (${(j.tasks ?? 0) + 1}/${TASKS_PER_DAY}).`, tasks: j.tasks };
  }
  if (!j.taskAt) return { ok: false, msg: 'Önce bir görev başlatın.' };
  const el = now - j.taskAt;
  if (el > TASK_MAX_MS) { j.taskAt = undefined; return { ok: false, msg: 'Görev yarım kaldı (zaman aşımı). Yeniden başlayın.' }; }
  if (el < TASK_MIN_MS) return { ok: false, msg: 'Bu kadar hızlı olmaz – işi düzgün yapın.' };
  j.taskAt = undefined; j.tasks = (j.tasks ?? 0) + 1;
  let tip = 0;
  if (el <= TASK_FAST_MS) {
    const amt = Math.round(Math.max(0.2, Math.min(1, j.wage * 0.08)) * 100) / 100;
    const payer = j.employerId === 'dis' ? 'dis' : w.people.filter((x) => x.id !== p.id && !x.playerId && x.money > 5 && x.jailedDays === 0).sort((a, c) => c.money - a.money)[w.day % 5]?.id;
    if (payer && transfer(w, payer, p.id, amt, 'bahşiş')) { tip = amt; p.incomeToday += amt; }
  }
  let paid = false;
  if (j.tasks >= TASKS_PER_DAY && j.paidDay !== w.day) { j.paidDay = w.day; payDay(w, p, j); paid = true; }
  const tipTxt = tip ? ` Çabuk iş: +${tip} D bahşiş!` : '';
  return { ok: true, msg: paid ? `✅ ${t.name} bitti (${TASKS_PER_DAY}/${TASKS_PER_DAY}) – günlük ücret ödendi.${tipTxt}` : `✅ ${t.name} bitti (${j.tasks}/${TASKS_PER_DAY}).${tipTxt}`, tasks: j.tasks, paid, tip };
}
