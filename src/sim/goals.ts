/** v1.7 personal goals for players (with titles + rewards) and Kayzer-given missions. */
import type { GoalId, Mission, Person, World } from './types';
import { findPerson } from './world';
import { log, personal } from './log';
import { transfer } from './economy';
import { nextId } from './rng';

export const GOALS: Record<GoalId, { title: string; label: string; desc: string; reward: number; progress: (w: World, p: Person) => number }> = {
  tuccar: { title: 'Zengin Tüccar', label: '💰 Zengin tüccar ol', desc: 'Kesende 2.000 Dinar biriktir.', reward: 150, progress: (_w, p) => Math.min(1, p.money / 2000) },
  meclisbaskani: { title: 'Meclis Başkanı', label: '🏛 Meclis başkanı ol', desc: 'Meclis’e gir ve 8 vekilden itibar kazan (itibar 40+, 8 dost).', reward: 200,
    progress: (w, p) => (p.meclis ? 0.4 : 0) + Math.min(0.3, Math.max(0, p.rep) / 40 * 0.3) + Math.min(0.3, w.people.filter((x) => x.meclis && (x.relations[p.id] ?? 0) > 30).length / 8 * 0.3) },
  vezir: { title: 'Vezir', label: '📜 Vezir ol', desc: 'Kayzer’in en güvendiği kişi ol: Kayzer’le ilişki 60+, sadakat 80+, itibar 20+.', reward: 250,
    progress: (w, p) => { const k = findPerson(w, w.kayzerId); if (!k || k.id === p.id) return 0; const r = Math.max(k.relations[p.id] ?? 0, p.relations[k.id] ?? 0); return Math.min(1, Math.max(0, r) / 60 * 0.5 + p.loyalty / 80 * 0.3 + Math.max(0, p.rep) / 20 * 0.2) * (r >= 60 && p.loyalty >= 80 && p.rep >= 20 ? 1 : 0.99); } },
  asi: { title: 'Gizli İsyan Lideri', label: '🗽 Gizli isyan lideri ol', desc: 'Gizlice 10 cumhuriyetçiyi (70+) kendine bağla (ilişki 30+). Yakalanma!', reward: 0,
    progress: (w, p) => Math.min(1, w.people.filter((x) => x.id !== p.id && x.republic >= 70 && (x.relations[p.id] ?? 0) > 30).length / 10) },
};

export function setGoal(p: Person, g: GoalId): string { if (!GOALS[g]) return 'Böyle bir hedef yok.'; p.goal = g; return `Yeni hedefiniz: ${GOALS[g].label}. ${GOALS[g].desc}`; }

/** Daily: completed goals give a title + reward. */
export function goalsDay(w: World): void {
  for (const p of w.people) {
    if (!p.playerId || !p.goal) continue; const g = GOALS[p.goal];
    if (g.progress(w, p) < 1) continue;
    p.goalsDone = [...(p.goalsDone ?? []), p.goal]; if (!p.titles.includes(g.title)) p.titles.push(g.title);
    if (g.reward > 0 && transfer(w, 'saray', p.id, g.reward, `hedef ödülü: ${g.title}`)) {} 
    if (p.goal === 'asi') { p.plotting = 'revolution'; personal(w, p.playerId, '🗽 Artık gizli isyan liderisiniz! Bir isyan başlarsa önder siz olursunuz.'); }
    else log(w, `🏅 ${p.name} “${g.title}” oldu!${g.reward ? ` (${g.reward} Dinar ödül)` : ''}`, p.id);
    p.goal = undefined;
  }
}

// ---------------- missions from the Kayzer ----------------
export function missionCreate(w: World, k: Person, text: string, reward: number, to: string | null): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer görev verir.';
  const t = text.trim().slice(0, 200); if (t.length < 4) return 'Görevi yazın.';
  const r = Math.max(0, Math.min(5000, Math.round(reward))); if (r > w.treasury) return 'Hazine bu ödülü karşılayamaz.';
  const m: Mission = { id: nextId(w, 'M'), text: t, reward: r, to, by: k.id, day: w.day, status: 'acik' };
  (w.missions ??= []).push(m); if (w.missions.length > 40) w.missions.splice(0, w.missions.length - 40);
  const tp = findPerson(w, to); if (tp?.playerId) personal(w, tp.playerId, `👑 Kayzer size görev verdi: “${t}” – ödül ${r} Dinar.`);
  log(w, `👑 Kayzer görev ilan etti: “${t}” (ödül ${r} Dinar${tp ? `, ${tp.name} için` : ', herkese açık'}).`, k.id);
  return 'Görev ilan edildi.';
}
export function missionClaim(w: World, p: Person, id: string): string {
  const m = w.missions?.find((x) => x.id === id); if (!m || m.status !== 'acik') return 'Görev açık değil.';
  if (m.to && m.to !== p.id) return 'Bu görev size verilmedi.';
  m.status = 'bildirildi'; m.claimedBy = p.id; const k = findPerson(w, m.by); if (k?.playerId) personal(w, k.playerId, `📜 ${p.name} “${m.text}” görevini tamamladığını bildirdi. Divan’dan ödeyin ya da reddedin.`);
  return 'Kayzer’e bildirdiniz; onaylarsa ödülü alırsınız.';
}
export function missionPay(w: World, k: Person, id: string, pay: boolean): string {
  if (k.id !== w.kayzerId) return 'Sadece Kayzer.'; const m = w.missions?.find((x) => x.id === id); if (!m || m.status !== 'bildirildi') return 'Bekleyen bildirim yok.';
  const p = findPerson(w, m.claimedBy); if (!p) { m.status = 'iptal'; return 'Kişi yok.'; }
  if (!pay) { m.status = 'acik'; m.claimedBy = undefined; if (p.playerId) personal(w, p.playerId, `❌ Kayzer “${m.text}” görevini tamamlanmış saymadı.`); return 'Reddedildi; görev yine açık.'; }
  if (!transfer(w, 'saray', p.id, m.reward, `görev ödülü: ${m.text.slice(0, 30)}`)) return 'Hazine yetmiyor.';
  m.status = 'odendi'; p.loyalty = Math.min(100, p.loyalty + 5); p.rep = Math.min(100, p.rep + 3); (k.relations[p.id] = Math.min(100, (k.relations[p.id] ?? 0) + 10));
  log(w, `👑 ${p.name}, Kayzer’in görevini tamamladı ve ${m.reward} Dinar ödül aldı.`, p.id); return 'Ödül verildi.';
}
