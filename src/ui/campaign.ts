/**
 * v2.0.2 player side of the propaganda (S) and party (U, W) packages: Partiler tab, Kampanya tab, Etkileşim buttons.
 * The sim (propaganda.ts, party.ts) was already used by NPCs; these panels let players do the same.
 */
import type { Ideology, Person } from '../sim/types';
import { h, bar, select } from './dom';
import type { Ctx } from './panels';
import { findPerson } from '../sim/world';
import { electionPhase, electionDates } from '../sim/tick';
import { GENELGE, GKINDS, type GKind } from '../sim/genelge';
import { AXIS_LABEL, axesOf, supportAvg, membersOf, mpsOf, rankInParty, DUES, JOIN_FEE, FOUND_FEE, MAJORITY, PROGRAMS, partyName } from '../sim/party';
import { MITING_COST, PARTY_POSTER } from '../sim/propaganda';
import { askConfirm } from './modal';

const IDEO: [Ideology, string][] = [['halkci', 'Halkçı'], ['esnaf', 'Esnaf'], ['cumhuriyetci', 'Cumhuriyetçi'], ['saltanatci', 'Saltanatçı']];
const campaigning = (c: Ctx): boolean => { const ph = electionPhase(c.w).phase; return ph === 'aday' || ph === 'propaganda'; };
const isCand = (c: Ctx, id?: string | null): boolean => !!id && c.w.election.candidates.includes(id);

/** U1 U3 U4 U5 U7 U9 U10 U11 W1: parties with program, axes, support, kasa, ranks; join/leave/dues/donate/Ocak/found. */
export function partiesTab(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const box = h('div', { class: 'stack' });
  const facs = w.meclis.factions; const seats = w.meclis.seats.filter((s) => s.holder).length || 1;
  const govt = w.meclis.govt ?? [];
  // seat chart by party (incl. Bağımsız) – adds up to the seat count
  const per = new Map<string, number>(); for (const s of w.meclis.seats) { if (!s.holder) continue; const p = findPerson(w, s.holder); const k = p?.faction && facs.some((f) => f.id === p.faction) ? p.faction : 'bagimsiz'; per.set(k, (per.get(k) ?? 0) + 1); }
  box.append(h('div', { class: 'card' }, h('b', {}, `🏛 Sandalye dağılımı (${seats}) · çoğunluk ${MAJORITY}`), h('div', { class: 'seatbar' }, ...[...per.entries()].map(([k, n]) => { const f = facs.find((x) => x.id === k); return h('span', { style: `flex:${n};background:${f?.color ?? '#777'}`, title: `${f?.name ?? 'Bağımsız'}: ${n}` }, String(n)); })),
    h('div', { class: 'muted' }, [...per.entries()].map(([k, n]) => `${facs.find((x) => x.id === k)?.name ?? 'Bağımsız'} ${n}`).join(' · ')),
    h('div', {}, `Hükümet: ${govt.map((id) => facs.find((f) => f.id === id)?.name).filter(Boolean).join(' + ') || '—'}${govt.length > 1 ? ' (koalisyon: ortaklar birlikte oy verir)' : ''}`),
    h('div', { class: 'muted' }, 'Sandalyeler D’Hondt yöntemiyle partilerin oyuna göre dağıtılır (16 sandalye); parti içinde sıra kişisel oya göredir; kotayı aşan bağımsız da kazanır. 9 sandalyesi olan yoksa koalisyon kurulur.')));
  for (const f of facs) {
    const ax = axesOf(f); const mine = me?.faction === f.id; const sup = supportAvg(f);
    const card = h('div', { class: 'card stack', style: `border-left:6px solid ${f.color}` });
    card.append(h('div', { class: 'row' }, h('span', { class: 'pbadge', style: `background:${f.color}` }), h('b', { class: 'grow' }, f.name), h('span', { class: 'muted' }, `${mpsOf(w, f).length} sandalye · ${membersOf(w, f).length} üye · lider: ${findPerson(w, f.leaderId)?.name ?? '—'}`), govt.includes(f.id) ? h('span', { class: 'pill' }, govt[0] === f.id ? 'hükümet' : 'koalisyon ortağı') : h('span', { class: 'pill' }, 'muhalefet')));
    card.append(h('div', { class: 'muted' }, `Program: ${(f.program ?? PROGRAMS[f.ideology]?.program ?? []).map((k) => GENELGE[k as GKind]?.label ?? k).join(' · ')}${f.oppose?.length ? ` — karşı: ${f.oppose.map((k) => GENELGE[k as GKind]?.label ?? k).join(', ')}` : ''}`));
    card.append(h('div', { class: 'axes' }, ...AXIS_LABEL.map(([n, lo, hi], i) => h('div', { class: 'row', style: 'gap:6px' }, h('small', { style: 'width:62px' }, n), h('small', { class: 'muted' }, lo), bar(ax[i]!, f.color), h('small', { class: 'muted' }, hi)))));
    card.append(h('div', { class: 'row', style: 'gap:6px' }, h('small', {}, `Halk desteği %${sup}`), bar(sup, f.color), h('small', { class: 'muted' }, `kasa ${Math.round(f.kasa ?? 0)} D`)));
    const sup2 = Object.entries(f.support ?? {}).map(([d, v]) => `${d} %${Math.round(v)}`).join(' · '); if (sup2) card.append(h('div', { class: 'muted' }, `Mahalle desteği: ${sup2}`));
    if (me) {
      const row = h('div', { class: 'row', style: 'flex-wrap:wrap' });
      if (!mine) row.append(h('button', { class: 'sm', title: `Üyelik ${JOIN_FEE} D, sonra günde ${DUES} D aidat`, onclick: () => c.act({ t: 'joinParty', factionId: f.id } as never) }, `Katıl (${JOIN_FEE} D)`));
      else {
        row.append(h('span', { class: 'pill' }, `${rankInParty(w, me) ?? 'Üye'} · parti itibarınız ${Math.round(f.standing?.[me.id] ?? 50)}`));
        row.append(h('button', { class: 'sm', title: 'Pazar’daki parti ocağında, günde bir kez: +parti itibarı, +1 itibar', onclick: () => c.act({ t: 'ocak' } as never) }, '🔥 Ocak toplantısı'));
        const amt = h('input', { type: 'number', min: '1', value: '10', style: 'width:70px' }) as HTMLInputElement; row.append(amt, h('button', { class: 'sm', onclick: () => c.act({ t: 'donate', amount: Number(amt.value) } as never) }, '💰 Bağış'));
        if (campaigning(c)) row.append(h('button', { class: 'sm', title: `Parti kasasından (yoksa kesenizden) ${PARTY_POSTER} D`, onclick: () => c.act({ t: 'partyPoster' } as never) }, `🪧 Parti afişi (${PARTY_POSTER} D)`));
        row.append(h('button', { class: 'sm danger', onclick: () => { void askConfirm(`${f.name}’nden istifa edilsin mi?`).then((y) => { if (y) c.act({ t: 'resignParty' } as never); }); } }, 'İstifa'));
      }
      card.append(row);
    }
    box.append(card);
  }
  if (me) {
    const nm = h('input', { placeholder: 'Yeni parti adı', maxlength: '30' }) as HTMLInputElement; const ide = select(IDEO);
    box.append(h('div', { class: 'card row', style: 'flex-wrap:wrap' }, h('b', {}, '🎉 Parti kur'), nm, ide, h('button', { class: 'sm', onclick: () => c.act({ t: 'foundParty', name: nm.value, ideology: ide.value as Ideology } as never) }, `Kur (${FOUND_FEE} D, itibar ≥30)`), h('div', { class: 'muted' }, 'Rütbeler: üye → il başkanı → genel başkan; liderlik her seçim döneminde yeniden seçilir, oyuncular da lider olabilir. Parti çizgisine aykırı oy parti itibarını düşürür; tekrarı ihraç getirir. Aynı partiden esnaf %5 indirim yapar.')));
  }
  const news = w.meclis.log.filter((l) => /parti|Parti|soru önergesi|denetim|koalisyon|ihraç|istifa/.test(l.text)).slice(-6).reverse();
  if (news.length) box.append(h('div', { class: 'card' }, h('b', {}, '📰 Parti haberleri'), ...news.map((l) => h('div', { class: 'msg' }, `Gün ${l.day}: ${l.text}`))));
  return box;
}

/** R1 R2 S1 S3 S5 S7 S8: calendar with countdown, vaat picker, miting, candidate cards, Seçim nabzı. */
export function campaignTab(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const e = w.election; const ph = electionPhase(w); const d = electionDates(w); const box = h('div', { class: 'stack' });
  const left = ph.phase === 'aday' ? d.adayTo - w.day + 1 : ph.phase === 'propaganda' ? e.nextDay - w.day : ph.phase === 'oylama' ? 0 : d.adayFrom - w.day;
  const RULES: Record<string, string> = { bekleme: 'Seçim zamanı değil: partiler örgütlenir, vaatler hazırlanır.', aday: 'Adaylık: 16+ yaş, asker/bekçi/Kayzer olmayan herkes aday olabilir (harç). Görevdeki vekiller çekilmezse otomatik aday sayılır.', propaganda: 'Propaganda: afiş, miting (Meydan’da, günde 1), kapı kapı “Bana oy ver”, ikram (pilav/şerbet). Para dağıtmak seçim rüşvetidir: yakalanırsanız dava + itibar −15.', oylama: 'Oylama: seçim günü Meclis binasındaki sandıkta, gizli oy. İlk 16 aday sandalye kazanır (D’Hondt ile partilere).' };
  box.append(h('div', { class: 'card' }, h('b', {}, `🗓 ${ph.label}`), h('div', { class: 'row' }, ...(['aday', 'propaganda', 'oylama'] as const).map((k) => h('button', { class: `sm${ph.phase === k ? ' primary' : ''}`, onclick: () => (box.querySelector('.phase-help') as HTMLElement).textContent = RULES[k]! }, k === 'aday' ? '1. Adaylık' : k === 'propaganda' ? '2. Propaganda' : '3. Oylama'))),
    h('div', { class: 'muted' }, left > 0 ? `Bu aşamanın bitmesine / sıradakine ${left} gün.` : 'Bugün seçim günü.'), h('div', { class: 'phase-help msg' }, RULES[ph.phase] ?? '')));
  if (e.nabiz) box.append(h('div', { class: 'card' }, h('b', {}, '📊 '), e.nabiz));
  if (me && isCand(c, me.id) && campaigning(c)) {
    const mineV = new Set(e.vaat?.[me.id] ?? []); const pick = h('div', { class: 'chips' });
    for (const k of GKINDS) { const cb = h('input', { type: 'checkbox' }) as HTMLInputElement; cb.checked = mineV.has(k); cb.dataset.k = k; pick.append(h('label', { class: 'chip', title: GENELGE[k].desc }, cb, ` ${GENELGE[k].label}`)); }
    const sp = h('input', { placeholder: 'Miting konuşması (boşsa vaatleriniz okunur)', maxlength: '160', style: 'flex:1' }) as HTMLInputElement;
    box.append(h('div', { class: 'card stack' }, h('b', {}, '📣 Kampanyanız'), h('div', { class: 'muted' }, 'Vaatler (1–3): seçmenler kendi ihtiyacına göre tartar. Seçilip vaadinizi önermezseniz itibar ve sonraki seçimde oy kaybedersiniz.'), pick,
      h('button', { class: 'sm primary', onclick: () => c.act({ t: 'vaat', kinds: [...pick.querySelectorAll('input:checked')].map((x) => (x as HTMLInputElement).dataset.k!) } as never) }, 'Vaatleri ilan et'),
      h('div', { class: 'row' }, sp, h('button', { class: 'sm', title: `Meydan’da, günde bir kez, izin ${MITING_COST} D (parti kasası öder)`, onclick: () => c.act({ t: 'miting', text: sp.value } as never) }, `📣 Miting (${MITING_COST} D)`), h('button', { class: 'sm', onclick: () => c.act({ t: 'poster' }) }, '📜 Afiş (5 D)')),
      h('div', { class: 'muted' }, 'Kapı kapı “Bana oy ver”, ikram ve kara propaganda: bir kişinin yanına gidip Etkileşim’den.')));
  }
  // candidate cards
  const cands = e.candidates.map((id) => findPerson(w, id)).filter((p): p is Person => !!p);
  if (cands.length) box.append(h('h3', {}, `Adaylar (${cands.length})`), h('div', { class: 'cand-grid' }, ...cands.slice(0, 40).map((p) => { const f = w.meclis.factions.find((x) => x.id === p.faction);
    return h('div', { class: 'card cand', style: `border-top:4px solid ${f?.color ?? '#777'}`, onclick: () => c.openPerson(p.id) }, h('b', {}, p.name), h('div', { class: 'muted' }, partyName(w, p.faction)),
      h('div', {}, (e.vaat?.[p.id] ?? []).map((k) => GENELGE[k]?.label ?? k).join(' · ') || '—'), h('small', { class: 'muted' }, `afiş ${e.posters?.[p.id] ?? 0} · destekleyen ${e.endorse?.[p.id]?.length ?? 0}`)); })));
  return box;
}

/** S2 S4 S6 + endorse: Etkileşim buttons on a person during the campaign. */
export function campaignButtons(c: Ctx, p: Person): HTMLElement[] {
  const me = c.me; if (!me || !campaigning(c) || p.id === me.id) return [];
  const out: HTMLElement[] = [];
  if (isCand(c, me.id)) {
    out.push(h('button', { onclick: () => c.act({ t: 'canvass', personId: p.id } as never) }, '🗳 Bana oy ver'));
    out.push(h('button', { title: '2 D – küçük sempati', onclick: () => c.act({ t: 'ikram', personId: p.id, kind: 'pilav' } as never) }, '🍚 Pilav ikram'));
    out.push(h('button', { title: '1 D', onclick: () => c.act({ t: 'ikram', personId: p.id, kind: 'serbet' } as never) }, '🥤 Şerbet'));
    out.push(h('button', { class: 'danger', title: 'Seçim rüşveti: yakalanırsanız dava + itibar −15', onclick: () => { void askConfirm('Para dağıtmak seçim rüşvetidir; yakalanırsanız dava açılır ve itibarınız 15 düşer. 10 D verilsin mi?').then((y) => { if (y) c.act({ t: 'ikram', personId: p.id, kind: 'para', amount: 10 } as never); }); } }, '💸 Para ver'));
  }
  if (isCand(c, p.id)) {
    if (me.faction && me.faction === p.faction) out.push(h('button', { onclick: () => c.act({ t: 'endorse', personId: p.id } as never) }, '🤝 Adaylığını destekle'));
    out.push(h('button', { class: 'danger', title: 'Adayın desteğini düşürür; ifşa olursa size döner (itibar −5)', onclick: () => c.act({ t: 'smear', personId: p.id } as never) }, '🗞 Kara propaganda'));
  }
  return out;
}
