/** v2.0.1 UI: yükselme yolu (Ben tab), İş İlanı Tahtası, Kışla window, cami/okul actions. */
import type { Building, Person } from '../sim/types';
import type { Ctx } from './panels';
import { bar, h } from './dom';
import { findPerson } from '../sim/world';
import { ASKER_LABEL, MAIN_LABEL, goalsFor, hoursText, itibarOf, nextReqs, rankLabel, rankOf, reqText, meetsReq, soldierWage } from '../sim/career';
import { isCuma, isRamazan, isBayram, trait, weekday, ASEVI_DAILY } from '../sim/piety';
import { yearsOf } from '../sim/age';

const num = (v: number, min: number, max: number): HTMLInputElement => h('input', { type: 'number', value: String(v), min: String(min), max: String(max), style: 'width:70px' });
const pbar = (have: number, need: number, label: string): HTMLElement => h('div', { class: 'goal-row' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', {}, `${have >= need ? '✅' : '▫️'} ${label}`), h('span', { class: 'muted' }, `${Math.min(have, need)}/${need}`)), bar((Math.min(have, need) / Math.max(1, need)) * 100, have >= need ? '#5fae5a' : '#e8c14a'));

/** Title shown with the name on the map and in cards. */
export function titleLine(c: Ctx, p: Person): string { const t = trait(p); return [rankLabel(c.w, p), t].filter(Boolean).join(' · '); }

/** Ben tab: rank, itibar, din with 'Neden değişti', next rank requirements, goals and the current job. */
export function careerBen(c: Ctx, me: Person): HTMLElement {
  const w = c.w; const it = itibarOf(me); const n = nextReqs(w, me);
  const box = h('div', { class: 'stack career' }, h('h3', {}, `🪜 Yükselme yolu: ${rankLabel(w, me)}`));
  if (me.prof === 'asker') box.append(h('div', { class: 'muted' }, `Askerlik: ${ASKER_LABEL[me.askerRank ?? 1]} · ana yol: ${MAIN_LABEL[rankOf(me)]} (terhiste kaldığınız yerden devam)`));
  box.append(h('div', { class: 'row' }, h('b', { style: 'min-width:80px' }, '⭐ İtibar'), bar(it, '#e8c14a'), h('span', {}, ` ${Math.round(it)}/100`)),
    h('div', { class: 'muted small' }, 'İtibar paradan ayrıdır: iş, sipariş, sadaka, borç ödemek, baskında savaşmak kazandırır; suç, rüşvet, zindan, işe gelmemek kaybettirir. 60+ pazarda indirim; 5’in altında kapılar kapanır; 0’ın altı = bir rütbe düşüş.'),
    h('div', { class: 'row' }, h('b', { style: 'min-width:80px' }, '🕌 Dindarlık'), bar(me.din, '#3a8a6a'), h('span', {}, ` ${Math.round(me.din)}/100`)),
    h('div', { class: 'muted small' }, 'Din: Cuma namazı +3, günlük namaz +1, sadaka +1, Ramazan orucu +5; içki −2, hırsızlık/cinayet −10, iki hafta Cuma’ya gitmemek −2. Etkisi: talebe 30 / hoca 60 / kadı 80; kıtlık ve salgında moral daha yavaş düşer; dindar esnaf size daha çok güvenir, meyhaneci tersine.'));
  const notes = (me.notes ?? []).slice(-5).reverse();
  if (notes.length) box.append(h('details', { open: '' } as never, h('summary', {}, 'Neden değişti?'), ...notes.map((x) => h('div', { class: 'msg' }, `Gün ${x.day} ${String(x.hour).padStart(2, '0')}:00 · ${x.kind === 'itibar' ? '⭐ itibar' : '🕌 din'} ${x.d > 0 ? '+' : ''}${x.d} — ${x.why}`))));
  if (n) {
    box.append(h('h3', {}, `🎯 Sonraki hedefin: ${n.next}`), ...n.reqs.map((r) => pbar(r.have, r.need, r.label)));
    if (n.approval) box.append(h('div', { class: 'muted' }, `+ ${n.approval}: şartlar tamamlanınca dilekçe kendiliğinden saraya gider.`));
    box.append(h('div', { class: 'muted small' }, `Kazancın: ${n.reward}`));
  } else box.append(h('div', { class: 'muted' }, 'Bu yolun zirvesindesiniz.'));
  const gs = goalsFor(me); const done = me.cs?.goals ?? {};
  if (gs.length) box.append(h('h3', {}, '📌 Görevler (para + itibar)'), ...gs.map((g) => { const hv = Math.round(g.have(w, me) * 10) / 10; return h('div', { class: done[g.id] ? 'card done' : 'card' }, pbar(done[g.id] ? g.need : hv, g.need, `${g.text} — ${g.money ? `${g.money} D` : ''}${g.money && g.it ? ' + ' : ''}${g.it ? `${g.it} itibar` : ''}`)); }));
  const j = me.job;
  box.append(h('h3', {}, '💼 İşin'), j ? h('div', { class: 'card' }, h('b', {}, j.title), h('div', { class: 'muted' }, `Saat ${hoursText(j)} · ${w.buildings.find((b) => b.id === j.place)?.name ?? j.place}${j.wage ? ` · günde ${j.wage} D` : ' · kendi kazancın'}${j.attDay === w.day ? ` · bugün ${j.att ?? 0} saat buradaydın` : ''}`),
    h('div', { class: 'muted small' }, 'Vardiyanın en az yarısında iş yerinde ol: ücret + 1 itibar. Çevrimiçiyken gelmezsen −2 itibar; 2 kez gelmeyen kovulur.'),
    me.prof !== 'asker' ? h('button', { onclick: () => c.act({ t: 'jobQuit' }) }, '🚪 İşi bırak') : '') : h('div', { class: 'muted' }, 'İşin yok. Pazar’daki İş İlanı Tahtası’na bak ya da bir esnafa “Bir iş var mı?” diye sor.'));
  return box;
}

/** İş İlanı Tahtası (at the Pazar). */
export function jobBoard(c: Ctx, _b: Building): HTMLElement {
  const w = c.w; const me = c.me; const jobs = w.jobs ?? [];
  const box = h('div', { class: 'stack job-board' }, h('h3', {}, '📋 İş İlanı Tahtası'));
  if (!jobs.length) box.append(h('div', { class: 'muted' }, 'Tahta boş; sabah yeni ilanlar asılır.'));
  for (const j of jobs) {
    const why = me ? meetsReq(w, me, j) : null; const mine = me?.job?.title === j.title;
    box.append(h('div', { class: 'card row inv-row' }, h('div', { style: 'flex:1' }, h('b', {}, j.title), h('div', { class: 'muted small' }, `${j.wage ? `günde ${j.wage} D` : 'kendi kazancın'} · ${hoursText(j)} · ${w.buildings.find((b) => b.id === j.place)?.name ?? j.place} · ${reqText(j)}`)),
      me ? h('button', { class: why ? '' : 'primary', disabled: mine, title: why ?? '', onclick: () => c.act({ t: 'jobApply', jobId: j.id }) }, mine ? 'Çalışıyorsun' : why ? 'Şart yok ✗' : 'Başvur') : ''));
  }
  if (me && ['usta', 'tuccar', 'esraf', 'soylu', 'danisman'].includes(rankOf(me))) {
    const t = h('input', { value: 'Yardımcı', maxlength: '40', style: 'width:120px' }); const wg = num(4, 1, 50), f = num(8, 0, 23), to = num(14, 0, 23);
    box.append(h('details', {}, h('summary', {}, '📌 İlan as (usta/tüccar)'), h('div', { class: 'row' }, t, 'ücret', wg, 'saat', f, '–', to, h('button', { class: 'primary', onclick: () => c.act({ t: 'jobPost', title: t.value, wage: Number(wg.value), from: Number(f.value), to: Number(to.value) }) }, 'As')), h('div', { class: 'muted small' }, 'Ücret her çalışılan gün kesenizden ödenir; kesenizde 3 günlük ücret olmalı.')));
  }
  return box;
}

/** Kışla Etkileşim window. */
export function kislaWindow(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const box = h('div', { class: 'stack kisla-window' }, h('h3', {}, '🪖 Kışla: kayıt subayı'));
  if (!me) return box;
  const sold = me.prof === 'asker'; const talimN = (me.cs?.talimDays ?? []).length;
  const b = (label: string, a: Parameters<Ctx['act']>[0], primary = false, dis = false, tip = ''): HTMLElement => h('button', { class: primary ? 'primary' : '', disabled: dis, title: tip, onclick: () => c.act(a) }, label);
  box.append(h('div', { class: 'row wrap' },
    b(`🏋 Talim yap (1 saat)`, { t: 'kisla', op: 'talim' }, true, false, 'Enerji −12, savaş becerisi +%1 (en çok %20)'),
    sold ? b('🛡 Teçhizat al', { t: 'kislaKit' }) : '',
    sold ? b('🚪 Terhis', { t: 'kisla', op: 'terhis' }) : b('✍️ Kayıt ol', { t: 'kisla', op: 'kayit' }, true, yearsOf(w, me) < 16, yearsOf(w, me) < 16 ? '16 yaşından itibaren' : '')));
  box.append(h('div', { class: 'muted small' }, `Talim: ${me.cs?.talim ?? 0} kez · ${talimN} gün${sold && (me.askerRank ?? 0) === 0 ? ` (Er olmak için ${talimN}/2 gün)` : ''} · savaş becerisi +%${me.cs?.skill ?? 0}`));
  if (sold) {
    const r = me.askerRank ?? 1;
    box.append(h('h3', {}, '⏰ Nöbet al'), h('div', { class: 'row' }, ...(['gunduz', 'aksam', 'gece'] as const).map((s) => b(s === 'gunduz' ? 'Gündüz 06–14' : s === 'aksam' ? 'Akşam 14–22' : 'Gece 22–06', { t: 'kisla', op: 'nobet', shift: s }, me.job?.from === (s === 'gunduz' ? 6 : s === 'aksam' ? 14 : 22), r === 0))),
      h('div', { class: 'muted small' }, `Şu an: ${me.job ? `${me.job.title} ${hoursText(me.job)}` : '—'} · maaş ${soldierWage(w, r)} D/gün. Nöbeti terk etmek ya da emre uymamak −1 rütbe; baskından kaçmak −2; rüşvet/zulüm = ordudan atılma + zindan.`));
    const n = nextReqs(w, me);
    box.append(h('h3', {}, `🎖 Rütbem: ${ASKER_LABEL[r]}`), ...(n ? [h('div', { class: 'muted' }, `Sonraki: ${n.next}`), ...n.reqs.map((x) => pbar(x.have, x.need, x.label)), n.approval ? h('div', { class: 'muted small' }, `+ ${n.approval}`) : ''] : [h('div', { class: 'muted' }, 'En yüksek rütbe.')]));
    if (r >= 5) { const cands = w.people.filter((x) => x.prof === 'asker' && (x.askerRank ?? 0) === 3 && x.playerId && !x.cs?.rec); if (cands.length) box.append(h('div', { class: 'row wrap' }, ...cands.map((x) => b(`✉️ ${x.name}’e tavsiye`, { t: 'recommend', personId: x.id })))); }
  } else box.append(h('div', { class: 'muted small' }, 'Askerlik: Acemi er (2 gün talim) → Er → Onbaşı → Çavuş → Yüzbaşı → Komutan. Askerken başka işte çalışılmaz; terhis ana yola döndürür.'));
  if (w.seferberlik) box.append(h('div', { class: 'card warn' }, `📯 Seferberlik ilan edildi (gün ${w.seferberlik}). Gönüllüler kayıt olabilir.`));
  return box;
}

/** Cami: namaz, Cuma, sadaka, aşevi, şifa duası. */
export function camiWindow(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const sd = num(5, 1, 1000);
  const box = h('div', { class: 'stack' }, h('div', { class: 'muted' }, `Bugün ${weekday(w.day)}.${isCuma(w.day) ? ' 🕌 Cuma: namaz 13:00–14:00, uyarı 11:00’de.' : ' Cuma namazı Cuma günü 13:00’te.'}${isRamazan(w.day) ? ' 🌙 Ramazan: 06–22 oruç.' : ''}${isBayram(w.day) ? ' 🎉 Bayram!' : ''}`));
  if (!me) return box;
  box.append(h('div', { class: 'row wrap' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'pray' }) }, isCuma(w.day) && w.hour === 13 ? '🕌 Cuma namazı kıl' : '🕌 Namaz kıl'),
    h('button', { onclick: () => c.act({ t: 'asevi' }), title: `Günde bir çorba; bugün kalan ${w.asevi?.day === w.day ? w.asevi.left : ASEVI_DAILY}` }, '🍲 Aşevi çorbası (ücretsiz)'),
    h('button', { onclick: () => c.act({ t: 'sifa' }), title: 'Hekim yoksa biraz iyileştirir (günde 1)' }, '🤲 Şifa duası')),
    h('div', { class: 'row' }, sd, h('button', { onclick: () => c.act({ t: 'sadaka', amount: Number(sd.value) }) }, '💝 Sadaka ver')),
    h('div', { class: 'muted small' }, 'Sadaka en yoksula gider: din +1 (günde 1), her 5 D için itibar +1 (günde en çok +3).'));
  if (me.prof === 'imam' || me.prof === 'hoca') box.append(h('div', { class: 'row' }, ...(['namaz', 'icki', 'sabir'] as const).map((t) => h('button', { onclick: () => c.act({ t: 'sermon', topic: t }) }, `Vaaz: ${t}`))));
  return box;
}
/** Okul: talebe, ders al, ders ver. */
export function okulWindow(c: Ctx): HTMLElement {
  const me = c.me; const box = h('div', { class: 'stack' }, h('h3', {}, '📖 Din-İlim yolu: Talebe → Hoca → Kadı'));
  if (!me) return box;
  box.append(h('div', { class: 'row wrap' },
    me.ilimRank === undefined ? h('button', { class: 'primary', onclick: () => c.act({ t: 'talebe' }), title: 'Dindarlık 30 gerekir' }, '🎓 Talebe ol') : '',
    h('button', { onclick: () => c.act({ t: 'oku' }), title: me.ilimRank === 0 ? 'Talebeye ücretsiz' : '1 D' }, `📚 Ders al${me.ilimRank === 0 ? '' : ' (1 D)'}`),
    me.prof === 'hoca' ? h('button', { onclick: () => c.act({ t: 'dersVer' }) }, '🧑‍🏫 Ders ver') : ''),
    h('div', { class: 'muted small' }, `Okuma dersi ${me.cs?.read ?? 0}${me.cs?.literate ? ' · ✅ okuma-yazma' : ' (3 derste okuma-yazma)'} · verilen ders ${me.cs?.taught ?? 0}. Hoca: din 60, 10 ders, itibar 30. Kadı: din 80, 5 ders verme, itibar 50 + Kayzer.`));
  return box;
}
export const nameOfPerson = (c: Ctx, id: string): string => findPerson(c.w, id)?.name ?? '?';
