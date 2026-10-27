import type { Action, Building, Good, Person, PetitionKind, Profession, World } from '../sim/types';
import { GOODS } from '../sim/types';
import { GOOD_LABEL, PLAYER_PROFS, PROF_LABEL, STATE_PROFS } from '../sim/constants';
import { coupStatus, officeOf } from '../sim/actions';
import { CRIME_LABEL } from '../sim/ai';
import { BILL_LABEL, tally, budgetLeft } from '../sim/meclis';
import type { Bill, BillKind, VoteChoice } from '../sim/types';
import { findPerson } from '../sim/world';
import { bar, fmt, h, select } from './dom';
import { spriteFor } from './sprites';
import { ONLINE_WINDOW_MS } from '../sim/constants';
import { age, ancestorsOf, canHaveChild, canRule, childrenOf, findChild, heirOf, isHanedan, nameOf, stage, STAGE_LABEL, ADULT_AGE, CHILD_UPKEEP, CURE_FEE, PROSPERITY_MONEY } from '../sim/family';
import { FATE_LABEL, strength, TARGETS } from '../sim/isyan';
import type { Child, Fate } from '../sim/types';

export interface Ctx {
  w: World; me: Person | null; founder: boolean;
  act: (a: Action) => void; dm: (personId: string) => void; openPerson: (id: string) => void;
}

const isK = (c: Ctx): boolean => !!c.me && canRule(c.w, c.me, Date.now(), ONLINE_WINDOW_MS);

export function avatar(p: Person, size = 64): HTMLCanvasElement {
  const c = h('canvas', { class: 'avatar', width: '16', height: '16' }); c.style.width = `${size}px`; c.style.height = `${size}px`;
  c.getContext('2d')!.drawImage(spriteFor(p)[0]!, 0, 0); return c;
}

function numIn(v: number, min = 0, max = 100000, step = 1): HTMLInputElement { return h('input', { type: 'number', value: String(v), min: String(min), max: String(max), step: String(step), style: 'width:90px' }); }

function personLine(c: Ctx, p: Person, extra?: Node | string): HTMLElement {
  return h('div', { class: 'row card', style: 'cursor:pointer' , onclick: () => c.openPerson(p.id) }, avatar(p, 32), h('b', {}, p.name), h('span', { class: 'muted' }, officeOf(c.w, p)), extra ?? '');
}

export function personCard(c: Ctx, p: Person): HTMLElement {
  const w = c.w; const mine = c.me?.id === p.id;
  const inv = GOODS.filter((g) => p.inv[g] > 0).map((g) => `${GOOD_LABEL[g]} ${p.inv[g]}`).join(', ') || 'boş';
  const rel = Object.entries(p.relations).sort((a, b) => b[1] - a[1]);
  const friends = rel.filter(([, v]) => v > 20).slice(0, 3).map(([id]) => findPerson(w, id)?.name).filter(Boolean).join(', ');
  const foes = rel.filter(([, v]) => v < -20).slice(-3).map(([id]) => findPerson(w, id)?.name).filter(Boolean).join(', ');
  const box = h('div', {},
    h('div', { class: 'row' }, avatar(p, 72), h('div', {}, h('h2', {}, p.name), h('div', { class: 'muted' }, officeOf(w, p), p.playerId ? ' · oyuncu' : ' · yapay vatandaş', p.jailedDays > 0 ? ' · ⛓ zindanda' : ''))),
    h('div', { class: 'card' }, `💭 “${p.thought || '…'}”`),
    h('table', {},
      h('tr', {}, h('td', {}, 'Kese'), h('td', {}, `${fmt(p.money)} Dinar`)),
      h('tr', {}, h('td', {}, 'Memnuniyet'), h('td', {}, bar(p.mood, '#5fae5a'), ` ${Math.round(p.mood)}`)),
      h('tr', {}, h('td', {}, 'Sadakat'), h('td', {}, bar(p.loyalty, '#e8c14a'), ` ${Math.round(p.loyalty)}`)),
      h('tr', {}, h('td', {}, 'Açlık / Susuzluk'), h('td', {}, `${Math.round(p.hunger)} / ${Math.round(p.thirst)}`)),
      h('tr', {}, h('td', {}, 'Sağlık'), h('td', {}, bar(p.health, '#c8483a'), ` ${Math.round(p.health)}`)),
      h('tr', {}, h('td', {}, 'Cumhuriyetçilik'), h('td', {}, bar(p.republic, '#5a8ad0'), ` ${Math.round(p.republic)}`)),
      h('tr', {}, h('td', {}, 'Eşyalar'), h('td', {}, inv)),
      h('tr', {}, h('td', {}, 'Yaş'), h('td', {}, `${age(w, p)} gün · ${STAGE_LABEL[stage(w, p)]}${p.soylu ? ' · soylu' : ''}${p.school ? ` · ${p.school} gün okul` : ''}`)),
      h('tr', {}, h('td', {}, 'Eşi'), h('td', {}, findPerson(w, p.spouse)?.name ?? '—')),
      h('tr', {}, h('td', {}, 'Ebeveyn'), h('td', {}, p.parents.map((id) => nameOf(w, id)).join(', ') || '—')),
      h('tr', {}, h('td', {}, 'Çocukları'), h('td', {}, childrenOf(w, p.id).map((k) => nameOf(w, k.id)).join(', ') || '—')),
      h('tr', {}, h('td', {}, 'Dostları'), h('td', {}, friends || '—')),
      h('tr', {}, h('td', {}, 'Küsleri'), h('td', {}, foes || '—')),
      h('tr', {}, h('td', {}, 'Son yaptığı'), h('td', {}, p.lastAction)),
    ),
  );
  if (!c.me || mine) {
    if (mine) box.append(h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'eat' }) }, '🍞 Ekmek ye')));
    return box;
  }
  const amt = numIn(10, 1);
  const actions = h('div', { class: 'row' }, amt,
    h('button', { onclick: () => c.act({ t: 'give', personId: p.id, amount: Number(amt.value) }) }, isK(c) ? '💰 Saraydan ver' : '💰 Para ver'),
    h('button', { onclick: () => c.act({ t: 'bribe', personId: p.id, amount: Number(amt.value) }) }, '🤫 Rüşvet'),
    h('button', { onclick: () => c.dm(p.id) }, '✉️ Mesaj'),
    !c.me.spouse && !p.spouse && p.prof !== 'naip' && stage(w, p) === 'yetiskin' ? h('button', { onclick: () => c.act({ t: 'marry', personId: p.id }) }, '💍 Evlenme teklif et') : '',
  );
  box.append(h('h3', {}, 'Ne yapacaksınız?'), actions);
  const risky = h('div', { class: 'row' });
  if (!isK(c)) risky.append(h('button', { class: 'danger', onclick: () => { if (confirm('Çalmak suçtur; bekçi yakalayabilir. Emin misiniz?')) c.act({ t: 'steal', personId: p.id }); } }, '🦹 Kesesini çal'));
  if (c.me.prof === 'bekci') risky.append(h('button', { onclick: () => c.act({ t: 'arrest', personId: p.id }) }, '⛓ Tutukla'));
  if (isK(c)) {
    const s = select([...STATE_PROFS, ...PLAYER_PROFS].map((x): [string, string] => [x, PROF_LABEL[x]]), p.prof);
    risky.append(s, h('button', { onclick: () => c.act({ t: 'appoint', personId: p.id, prof: s.value as Profession }) }, '📜 Ata'));
  }
  box.append(risky);
  return box;
}

function marketPanel(c: Ctx, b: Building): HTMLElement {
  const w = c.w; const box = h('div', {});
  const here = w.listings.filter((l) => l.market === b.id || b.id === 'pazar');
  const goods = GOODS.filter((g) => here.some((l) => l.good === g) || b.id === 'pazar');
  box.append(h('div', { class: 'muted' }, b.id === 'pazar' ? 'Büyük Pazar: bütün tezgâhlar burada görünür.' : 'Bu çarşının tezgâhları. Fiyatlar arz ve talebe göre her gün değişir.'));
  const t = h('table', {}, h('tr', {}, h('th', {}, 'Mal'), h('th', {}, 'En ucuz'), h('th', {}, 'Stok'), h('th', {}, '')));
  for (const g of goods) {
    const ls = here.filter((l) => l.good === g).sort((a, x) => a.price - x.price);
    const stock = ls.reduce((s, l) => s + l.qty, 0);
    t.append(h('tr', {}, h('td', {}, GOOD_LABEL[g]), h('td', {}, ls[0] ? `${ls[0].price.toFixed(2)} D` : '—'), h('td', {}, String(stock)),
      h('td', {}, h('button', { disabled: !c.me || !stock, onclick: () => c.act({ t: 'buy', good: g, qty: 1 }) }, 'Al 1'), ' ', h('button', { disabled: !c.me || stock < 5, onclick: () => c.act({ t: 'buy', good: g, qty: 5 }) }, 'Al 5'))));
  }
  box.append(t);
  if (c.me) {
    const g = select(GOODS.map((x): [string, string] => [x, `${GOOD_LABEL[x]} (elde ${c.me!.inv[x]})`]));
    const q = numIn(1, 1, 500); const pr = numIn(Math.round(w.prices.ekmek * 100) / 100, 0.1, 1000, 0.1);
    g.addEventListener('change', () => { pr.value = String(w.prices[g.value as Good]); });
    box.append(h('h3', {}, 'Tezgâha mal koy'), h('div', { class: 'row' }, g, 'adet', q, 'fiyat', pr, h('button', { onclick: () => c.act({ t: 'sell', good: g.value as Good, qty: Number(q.value), price: Number(pr.value) }) }, 'Sat')));
    const mine = w.listings.filter((l) => l.sellerId === c.me!.id);
    if (mine.length) box.append(h('div', { class: 'muted' }, 'Tezgâhınız: ' + mine.map((l) => `${GOOD_LABEL[l.good]} ${l.qty}×${l.price.toFixed(2)}`).join(', ')));
  }
  if (b.id === 'kahve') {
    box.append(h('h3', {}, '☕ Kahvehane dedikodusu'));
    for (const e of w.events.slice(-8).reverse()) box.append(h('div', { class: 'msg' }, `Gün ${e.day} ${String(e.hour).padStart(2, '0')}:00 — ${e.text}`));
  }
  return box;
}

function sarayPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const pending = w.petitions.filter((p) => p.status === 'bekliyor');
  const k = findPerson(w, w.kayzerId);
  box.append(h('div', { class: 'muted' }, w.regime === 'cumhuriyet' ? (k ? `Cumhuriyet. Başkan: ${k.name} (seçim ${w.election.baskanNextDay}. gün). Kanunlar Meclis oyuyla değişir. Hazine: ${fmt(w.treasury)} Dinar.` : `Cumhuriyet ilan edildi. Başkanlık seçimi ${w.election.baskanNextDay}. gün; o zamana kadar Naip Maecenas yönetiyor.`) : k ? `Tahtta: ${k.name}. Hazine: ${fmt(w.treasury)} Dinar. Meclis tekliflerine verdiğiniz veto kesindir, ama halkın gönlünü biraz kırar.` : 'Taht boş.'));
  if (isK(c)) {
    box.append(h('h3', {}, `📜 Dilekçeler (${pending.length})`));
    if (!pending.length) box.append(h('div', { class: 'muted' }, 'Bekleyen dilekçe yok.'));
    for (const p of pending) {
      const from = findPerson(w, p.fromId);
      box.append(h('div', { class: 'card' }, h('b', {}, from?.name ?? '?'), h('span', { class: 'muted' }, ` · ${p.kind} · son gün ${p.expires}`), h('div', {}, `“${p.text}”`),
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'answer', petitionId: p.id, accept: true }) }, '✔ Kabul'), h('button', { onclick: () => c.act({ t: 'answer', petitionId: p.id, accept: false }) }, '✖ Ret'))));
    }
    const ps = pendingSanctions(c);
    box.append(h('h3', {}, `🏛 Meclis kararları (${ps.length})`), ...(ps.length ? ps : [h('div', { class: 'muted' }, 'Onay bekleyen karar yok.')]));
    box.append(h('div', { class: 'card' }, `💼 Bütçe: ${w.budget.approved ? 'Meclis onaylı' : 'geçici (onaysız)'} · kalan ${fmt(budgetLeft(w))} / ${fmt(w.budget.limit)} Dinar · ${w.budget.until}. güne kadar. Bayram, bağış, inşaat ödeneği ve büyük yardımlar bütçeden düşer.`));
    const tax = numIn(w.taxRate, 0, 40); const head = numIn(w.headTax, 0, 10, 0.5);
    box.append(h('h3', {}, '⚖️ Fermanlar'),
      h('div', { class: 'row' }, 'Satış vergisi %', tax, h('button', { onclick: () => c.act({ t: 'setTax', rate: Number(tax.value) }) }, 'Uygula')),
      h('div', { class: 'row' }, 'Baş vergisi (Dinar/gün)', head, h('button', { onclick: () => c.act({ t: 'setHeadTax', amount: Number(head.value) }) }, 'Uygula')),
      h('div', { class: 'muted' }, `Bugün şimdiye kadar: gelir ${fmt(w.dailyIncome)}, gider ${fmt(w.dailyExpense)} Dinar. Son günlerin hazinesi: ${w.stats.slice(-5).map((s) => fmt(s.treasury)).join(' → ') || '—'}`));
    const sal = h('table', {}, h('tr', {}, h('th', {}, 'Görev'), h('th', {}, 'Kişi'), h('th', {}, 'Maaş')));
    for (const pr of STATE_PROFS) {
      const n = numIn(w.salaries[pr] ?? 0, 0, 60);
      sal.append(h('tr', {}, h('td', {}, PROF_LABEL[pr]), h('td', {}, String(w.people.filter((p) => p.prof === pr).length)), h('td', {}, n, h('button', { onclick: () => c.act({ t: 'setSalary', prof: pr, amount: Number(n.value) }) }, '✓'))));
    }
    box.append(h('h3', {}, '💰 Maaşlar (günlük)'), sal);
    box.append(h('h3', {}, '📚 Kanunlar'));
    for (const l of w.laws) {
      const p = l.param !== undefined ? numIn(l.param, 0, 100) : null;
      box.append(h('div', { class: 'card' }, h('b', {}, `${l.active ? '🟢' : '⚪'} ${l.name}`), h('div', { class: 'muted' }, l.desc),
        h('div', { class: 'row' }, p ? l.paramLabel ?? '' : '', p ?? '', h('button', { onclick: () => c.act({ t: 'toggleLaw', lawId: l.id, active: !l.active, param: p ? Number(p.value) : undefined }) }, l.active ? 'Kaldır' : 'Yürürlüğe koy'),
          p ? h('button', { onclick: () => c.act({ t: 'toggleLaw', lawId: l.id, active: l.active, param: Number(p.value) }) }, 'Değeri kaydet') : '')));
    }
    if (k && c.me && k.id === c.me.id && w.regime === 'imparatorluk') {
      const kids = childrenOf(w, k.id); const heir = heirOf(w, k);
      const sel = select([['', 'En büyük çocuk (varsayılan)'], ...kids.map((x): [string, string] => [x.id, `${nameOf(w, x.id)}${x.adult ? '' : ' (reşit değil)'}`])], w.veliaht ?? '');
      box.append(h('h3', {}, '👑 Veraset'),
        h('div', { class: 'muted' }, `Varis: ${heir ? nameOf(w, heir.id) + (heir.adult ? '' : ' (reşit olana dek eşiniz naip)') : findPerson(w, k.spouse) ? `eşiniz ${findPerson(w, k.spouse)!.name}` : 'yok'}.`),
        h('div', { class: 'row' }, 'Veliaht:', sel, h('button', { onclick: () => c.act({ t: 'veliaht', childId: sel.value || null }) }, 'Belirle')),
        h('button', { class: 'danger', onclick: () => { if (confirm('Tahttan feragat edilsin mi? Hanedan hakkınız sürer.')) c.act({ t: 'abdicate' }); } }, '🏳 Tahttan feragat et'));
    }
    const fest = numIn(150, 50, 5000);
    box.append(h('h3', {}, '🎉 Bayram'), h('div', { class: 'row' }, fest, 'Dinar', h('button', { onclick: () => c.act({ t: 'festival', cost: Number(fest.value) }) }, 'Bayram ilan et')),
      h('div', { class: 'muted' }, 'Hazineden herkese harçlık dağıtılır; memnuniyet artar, cumhuriyet isteği azalır.'));
  } else if (c.me) {
    const kind = select([['yardim', 'Yardım isteği'], ['is', 'İş isteği'], ['vergi', 'Vergi şikâyeti'], ['sikayet', 'Şikâyet'], ['kanun', 'Kanun teklifi'], ['gorev', 'Devlet görevi isteği']]);
    const text = h('textarea', { rows: '2', style: 'width:100%', placeholder: 'Efendim, …' });
    const amount = numIn(15, 0, 500);
    const law = select(w.laws.map((l): [string, string] => [l.id, `${l.name} (${l.active ? 'kaldırılsın' : 'çıkarılsın'})`]));
    const role = select(STATE_PROFS.map((x): [string, string] => [x, PROF_LABEL[x]]));
    box.append(h('h3', {}, '📜 Saraya dilekçe yaz'), h('div', { class: 'row' }, kind, 'tutar', amount), h('div', { class: 'row' }, 'kanun:', law, 'görev:', role), text,
      h('button', { class: 'primary', onclick: () => c.act({ t: 'petition', kind: kind.value as PetitionKind, text: text.value, amount: Number(amount.value), payload: kind.value === 'kanun' ? law.value : kind.value === 'gorev' ? role.value : undefined }) }, 'Gönder'),
      h('div', { class: 'muted' }, (w.regime === 'cumhuriyet' ? 'Başkan' : 'Kayzer') + ' çevrimdışıysa Naip Maecenas küçük yardım ve iş dilekçelerini cevaplar; kanun, vergi ve görev isteklerini saklar.'));
  }
  if ((c.founder || (c.me && isHanedan(w, c.me.id))) && w.kayzerId !== c.me?.id) box.append(h('h3', {}, '👑 Hanedan hakkı'), h('button', { class: 'primary', onclick: () => c.act({ t: 'restore' }) }, 'Tahtı geri al'));
  return box;
}

function courtPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const open = w.cases.filter((x) => x.stage !== 'kapandi'); const closed = w.cases.filter((x) => x.stage === 'kapandi').slice(-6).reverse();
  box.append(h('div', { class: 'muted' }, 'Akış: Bekçi yakalar → Savcı dava açar ya da düşürür → Hâkim karar verir. Kayzer affedebilir.'));
  box.append(h('h3', {}, `Açık davalar (${open.length})`));
  for (const cs of open) {
    const a = findPerson(w, cs.accusedId);
    const row = h('div', { class: 'row' });
    if (c.me?.prof === 'savci' && cs.stage === 'savci') row.append(h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'kovustur' }) }, 'Kovuştur'), h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'dusur' }) }, 'Düşür'));
    if (c.me?.prof === 'hakim' && cs.stage === 'hakim') row.append(h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'suclu' }) }, 'Suçlu'), h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'beraat' }) }, 'Beraat'));
    if (isK(c)) row.append(h('button', { onclick: () => c.act({ t: 'pardon', caseId: cs.id }) }, '🕊 Af'));
    box.append(h('div', { class: 'card' }, h('b', {}, `${CRIME_LABEL[cs.crime]}: ${a?.name ?? '?'}`), h('div', { class: 'muted' }, `aşama: ${cs.stage === 'savci' ? 'Savcıda' : 'Hâkimde'} · delil ${cs.evidence} · ${cs.amount} Dinar`), row));
  }
  if (closed.length) box.append(h('h3', {}, 'Son kararlar'), ...closed.map((cs) => h('div', { class: 'msg' }, `${CRIME_LABEL[cs.crime]} – ${findPerson(w, cs.accusedId)?.name ?? '?'}: ${cs.verdict ?? ''} ${cs.sentence ?? ''}`)));
  box.append(h('h3', {}, '📚 Kanun kitabı'), ...w.laws.map((l) => h('div', { class: 'msg' }, `${l.active ? '🟢' : '⚪'} ${l.name}: ${l.desc}`)));
  return box;
}

function kislaPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const soldiers = w.people.filter((p) => p.prof === 'asker');
  const avgL = soldiers.reduce((s, p) => s + p.loyalty, 0) / Math.max(1, soldiers.length);
  box.append(h('div', { class: 'muted' }, `${soldiers.length} asker · ortalama sadakat ${Math.round(avgL)}`));
  for (const s of soldiers) box.append(personLine(c, s, h('span', {}, bar(s.loyalty, '#e8c14a'))));
  if (c.me && !isK(c)) {
    box.append(h('h3', {}, '🗡 Komplo'));
    if (w.coup?.leaderId === c.me.id) {
      const st = coupStatus(w, c.me.id); const f = numIn(100, 1);
      box.append(h('div', { class: 'card' }, `${w.coup.kind === 'coup' ? 'Darbe' : 'Devrim'} hazırlığı: asker ${st.soldiers}/${st.need} · fon ${fmt(st.fund)}/${st.fundNeed} · halk desteği ${st.support ? 'VAR' : 'YOK'}`),
        h('div', { class: 'row' }, f, h('button', { onclick: () => c.act({ t: 'fundPlot', amount: Number(f.value) }) }, 'Fona koy'), h('button', { class: 'danger', onclick: () => { if (confirm(st.ok ? 'Şartlar tamam. Sarayı basıyoruz?' : 'Şartlar TAMAM DEĞİL. Başarısız olursanız tutuklanırsınız. Yine de?')) c.act({ t: 'seize' }); } }, '⚔️ Sarayı bas'), h('button', { onclick: () => c.act({ t: 'plot', kind: 'none' }) }, 'Vazgeç')),
        h('div', { class: 'muted' }, 'Askerleri kazanmak için kartlarına dokunup en az 40 Dinar rüşvet verin.'));
    } else if (w.coup) box.append(h('div', { class: 'muted' }, 'Kışlada başka biri fısıldaşıyor…'));
    else box.append(h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'plot', kind: 'coup' }) }, 'Darbe hazırla'), h('button', { onclick: () => c.act({ t: 'plot', kind: 'revolution' }) }, 'Devrim hazırla')), h('div', { class: 'muted' }, 'Kurallar 📖 sayfasında yazılıdır.'));
  }
  if ((c.founder || (c.me && isHanedan(w, c.me.id))) && w.kayzerId !== c.me?.id) box.append(h('button', { class: 'primary', onclick: () => c.act({ t: 'restore' }) }, '👑 Hanedan hakkı: tahtı geri al'));
  return box;
}

const VOTE_ICON: Record<VoteChoice, string> = { evet: '✅', hayir: '❌', cekimser: '➖' };
function billCard(c: Ctx, b: Bill, open: boolean): HTMLElement {
  const w = c.w; const t = tally(b); const prop = findPerson(w, b.proposerId);
  const status: Record<Bill['status'], string> = { tartisma: `görüşmede (oylama ${b.debateUntil + 1}. gün)`, oylama: `OYLAMADA (sonuç ${b.voteUntil}. gün sonu)`, onay: 'Kayzer onayı bekliyor', kabul: 'KABUL – yürürlükte', ret: 'RET', veto: 'VETO (kesin)', zamanasimi: 'düştü' };
  const card = h('div', { class: 'card' }, h('b', {}, `${BILL_LABEL[b.kind]}: ${b.title}`), h('div', { class: 'muted' }, `Teklif: ${prop?.name ?? '?'} · ${status[b.status]} · ${t.evet}✅ ${t.hayir}❌ ${t.cekimser}➖`));
  if (open || b.speeches.length) for (const sp of b.speeches.slice(-4)) card.append(h('div', { class: 'msg' }, h('b', {}, findPerson(w, sp.personId)?.name ?? '?'), ': ', sp.text));
  if (!open) {
    const rows = Object.entries(b.votes).map(([id, v]) => `${VOTE_ICON[v]} ${findPerson(w, id)?.name ?? '?'}`);
    if (rows.length) card.append(h('div', { class: 'muted' }, rows.join(' · ')));
  }
  if (open && c.me?.meclis) {
    const mine = b.votes[c.me.id];
    card.append(h('div', { class: 'row' }, ...(['evet', 'hayir', 'cekimser'] as const).map((v) => h('button', { class: mine === v ? 'primary' : '', onclick: () => c.act({ t: 'castVote', billId: b.id, choice: v }) }, `${VOTE_ICON[v]} ${v}`))));
    const sp = h('input', { placeholder: 'Kürsüden konuşun…', maxlength: '200', style: 'flex:1' });
    card.append(h('div', { class: 'row' }, sp, h('button', { onclick: () => c.act({ t: 'speak', billId: b.id, text: sp.value }) }, '🎤 Konuş')));
  }
  if (b.status === 'onay' && isK(c)) card.append(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'sanction', billId: b.id, approve: true }) }, '✔ Onayla'), h('button', { class: 'danger', onclick: () => { if (confirm('Veto kesindir ve halkın gönlünü biraz kırar (+0,7 cumhuriyet isteği, −1,5 sadakat). Emin misiniz?')) c.act({ t: 'sanction', billId: b.id, approve: false }); } }, '✖ Veto')));
  return card;
}

export function pendingSanctions(c: Ctx): HTMLElement[] { return c.w.meclis.bills.filter((b) => b.status === 'onay').map((b) => billCard(c, b, false)); }

function meclisPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const fac = (id: string | null) => w.meclis.factions.find((f) => f.id === id);
  if (w.regime === 'cumhuriyet') {
    const b = findPerson(w, w.kayzerId);
    box.append(h('h3', {}, '🗽 Başkanlık'), h('div', { class: 'muted' }, `Başkan: ${b?.name ?? 'yok'} · sonraki Başkanlık seçimi ${w.election.baskanNextDay}. gün (görev süresi 20 gün). Meclis kanunları çoğunlukla çıkarır, Başkanı 2/3 ile azledebilir.`));
    for (const id of w.election.baskanCandidates) { const p = findPerson(w, id); if (p) box.append(personLine(c, p, h('button', { onclick: (e) => { e.stopPropagation(); c.act({ t: 'voteBaskan', candidateId: id }); } }, 'Başkanlığa oy'))); }
    if (c.me) box.append(h('button', { class: 'primary', onclick: () => c.act({ t: 'runForBaskan' }) }, 'Başkan adayı ol'));
  } else box.append(h('div', { class: 'muted' }, 'İmparatorlukta Meclis’in kabul ettiği kararlar Kayzer’in onayına gider. Kayzer’in vetosu kesindir, aşılamaz.'));
  // seat chart
  box.append(h('h3', {}, `🪑 Sandalyeler · seçim ${w.election.nextDay}. gün · üye maaşı ${w.meclis.salary} D`));
  const chart = h('div', { class: 'row' });
  for (const s of w.meclis.seats) {
    const p = findPerson(w, s.holder); const f = fac(p?.faction ?? null);
    const seat = h('div', { class: 'card', style: `cursor:pointer;min-width:120px;border-left:6px solid ${f?.color ?? '#555'}`, onclick: () => p && c.openPerson(p.id) },
      h('div', { class: 'muted' }, `${s.kind === 'bolge' ? '📍' : '🛠'} ${s.label}`), h('b', {}, p?.name ?? 'boş'), h('div', { class: 'muted' }, `${f?.name ?? '—'}${p && !p.immune ? ' · dokunulmazlık yok' : ''}`));
    chart.append(seat);
  }
  box.append(chart);
  box.append(h('h3', {}, '🎌 Partiler'));
  for (const f of w.meclis.factions) {
    const n = w.people.filter((p) => p.meclis && p.faction === f.id).length;
    box.append(h('div', { class: 'row card', style: `border-left:6px solid ${f.color}` }, h('b', {}, f.name), h('span', { class: 'muted' }, `${n} sandalye · lider: ${findPerson(w, f.leaderId)?.name ?? '—'}`),
      c.me && c.me.faction !== f.id ? h('button', { onclick: () => c.act({ t: 'joinFaction', factionId: f.id }) }, 'Katıl') : c.me?.faction === f.id ? h('span', {}, '✓ üyesiniz') : ''));
  }
  // active bills
  const active = w.meclis.bills.filter((b) => ['tartisma', 'oylama', 'onay'].includes(b.status));
  box.append(h('h3', {}, `📜 Gündem (${active.length})`));
  if (!active.length) box.append(h('div', { class: 'muted' }, 'Görüşülen teklif yok.'));
  for (const b of active) box.append(billCard(c, b, b.status !== 'onay'));
  if (c.me?.meclis) {
    const kind = select((Object.keys(BILL_LABEL) as BillKind[]).map((k): [string, string] => [k, BILL_LABEL[k]]));
    const val = numIn(10, 0, 50000);
    const target = select([['', '— hedef —'], ...w.laws.map((l): [string, string] => [l.id, `Kanun: ${l.name}`]), ...GOODS.map((g): [string, string] => [g, `Mal: ${GOOD_LABEL[g]}`]), ['meclis', 'Maaş: Meclis üyesi'], ...STATE_PROFS.map((p): [string, string] => [p, `Maaş: ${PROF_LABEL[p]}`]), ...w.people.filter((p) => p.prof !== 'naip').map((p): [string, string] => [p.id, `Kişi: ${p.name}`])]);
    box.append(h('h3', {}, '✍️ Teklif ver'), h('div', { class: 'row' }, kind, 'değer', val, target, h('button', { class: 'primary', onclick: () => c.act({ t: 'propose', kind: kind.value as BillKind, value: Number(val.value), target: target.value }) }, 'Teklif et')),
      h('div', { class: 'muted' }, 'Vergi/bütçe/inşaat için “değer”, narh için mal ve fiyat, maaş için görev ve tutar, gensoru/soruşturma/dokunulmazlık için kişi seçin.'));
  } else if (c.me && !isK(c)) box.append(h('button', { onclick: () => c.act({ t: 'runForMeclis' }) }, 'Meclise aday ol (kendi mahalleniz ve meslek sandalyeniz için)'));
  for (const id of w.election.candidates) { const p = findPerson(w, id); if (p) box.append(personLine(c, p, h('button', { onclick: (e) => { e.stopPropagation(); c.act({ t: 'vote', candidateId: id }); } }, 'Oy ver'))); }
  // history
  const done = w.meclis.bills.filter((b) => !['tartisma', 'oylama', 'onay'].includes(b.status)).slice(-8).reverse();
  if (done.length) box.append(h('h3', {}, '🗳 Oylama geçmişi'), ...done.map((b) => billCard(c, b, false)));
  box.append(h('h3', {}, '📰 Meclis gazetesi'), ...w.meclis.log.slice(-10).reverse().map((l) => h('div', { class: 'msg' }, `Gün ${l.day}: ${l.text}`)));
  return box;
}

function santiyePanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  for (const p of w.projects.slice(-4).reverse()) {
    const f = numIn(50, 1);
    box.append(h('div', { class: 'card' }, h('b', {}, `${p.done ? '✅' : '🏗'} ${p.name}`), h('div', {}, bar(p.progress / p.needed * 100, '#e8c14a'), ` ${p.progress}/${p.needed} · ödenek kasası ${fmt(p.paid)} Dinar`),
      !p.done && c.me ? h('div', { class: 'row' }, f, h('button', { onclick: () => c.act({ t: 'fundProject', projectId: p.id, amount: Number(f.value) }) }, isK(c) ? 'Hazineden ödenek ayır' : 'Bağış yap')) : ''));
  }
  if (isK(c)) {
    const n = h('input', { placeholder: 'İnşaat adı', value: 'Yeni Çeşme' }); const cost = numIn(600, 100, 20000);
    box.append(h('h3', {}, 'Yeni inşaat'), h('div', { class: 'row' }, n, cost, h('button', { onclick: () => c.act({ t: 'startProject', name: n.value, cost: Number(cost.value) }) }, 'Başlat')), h('div', { class: 'muted' }, 'İnşaatçılar günde 6 Dinar yevmiye alır; ödenek bitince iş durur.'));
  }
  return box;
}

const INFO: Record<string, string> = {
  okul: 'Öğretmenler çocuklara okuma yazma öğretiyor. Hocalar maaşını hazineden alır.',
  cami: 'Hoca Abdullah’ın camisi. Düğünler avluda yapılır.',
  hekimhane: 'Sağlığı bozulan vatandaşlar hekime 4 Dinar öder. Parası olmayana darülaceze (hazine) bakar.',
  liman: 'Balıkçılar her sabah ağ atar; balık çabuk bozulur.',
  kasaphane: 'Kasaplar et keser. Et pahalıdır ama insanı mutlu eder.',
  degirmen: 'Değirmen fırınlara un öğütür.',
  kuyu: 'Sucular kuyudan su çeker. Devlet Suyu kanunu fiyatı sabitler.',
  atolye: 'Terziler kumaş, demirciler alet, marangozlar odun ve mobilya yapar.',
  firin: 'Fırıncılar ekmek pişirir. Buraya askıda ekmek bırakabilirsiniz.',
  zindan: 'Yargılanan ve hüküm giyenler burada yatar.',
};

export function buildingPanel(c: Ctx, b: Building): HTMLElement {
  const w = c.w;
  const box = h('div', {}, h('h2', {}, b.name));
  if (b.market) box.append(marketPanel(c, b));
  else if (b.id === 'saray') box.append(sarayPanel(c));
  else if (b.id === 'mahkeme') box.append(courtPanel(c));
  else if (b.id === 'kisla') box.append(kislaPanel(c));
  else if (b.id === 'meclis') box.append(meclisPanel(c));
  else if (b.id === 'santiye') box.append(santiyePanel(c));
  else {
    if (INFO[b.id]) box.append(h('div', { class: 'muted' }, INFO[b.id]!));
    if (b.id === 'firin' && c.me) { const q = numIn(3, 1, 20); box.append(h('div', { class: 'row' }, q, h('button', { onclick: () => c.act({ t: 'askida', qty: Number(q.value) }) }, '🥖 Askıda ekmek bırak'))); }
  }
  const people = w.people.filter((p) => (b.id === 'zindan' ? p.jailedDays > 0 : b.kind === 'ev' ? p.home === b.id : p.work === b.id && p.jailedDays === 0));
  if (people.length && b.id !== 'kisla') {
    box.append(h('h3', {}, b.kind === 'ev' ? 'Oturanlar' : b.id === 'zindan' ? 'Mahkûmlar' : `Burada çalışanlar (${people.length})`));
    for (const p of people.slice(0, 30)) box.append(personLine(c, p));
  }
  return box;
}

// ---------- Aile ----------
function childCard(c: Ctx, k: Child): HTMLElement {
  const w = c.w; const st = stage(w, k); const mine = !!c.me && k.parents.includes(c.me.id);
  const row = h('div', { class: 'row' });
  if (mine && (st === 'cocuk' || st === 'genc')) row.append(h('button', { onclick: () => c.act({ t: 'school', childId: k.id, on: !k.inSchool }) }, k.inSchool ? '🏫 Okuldan al' : '🏫 Okula yaz (1 D/gün)'));
  if (mine && k.sick > 0) row.append(h('button', { class: 'primary', onclick: () => c.act({ t: 'cure', childId: k.id }) }, `🩺 Hekime götür (${CURE_FEE} D)`));
  return h('div', { class: 'card' }, h('b', {}, `${k.female ? '👧' : '👦'} ${k.name}`), h('span', { class: 'muted' }, ` · ${STAGE_LABEL[st]} · ${age(w, k)} gün (yetişkinlik ${ADULT_AGE})`),
    h('div', { class: 'muted' }, `${k.inSchool ? '🏫 okulda' : 'okula gitmiyor'} · okul ${k.school} gün · ${k.sick > 0 ? `🤒 hasta (${k.sick}. gün)` : 'sağlıklı'}${k.hunger > 0 ? ' · aç' : ''}${k.orphan ? ' · yetim (devlet bakıyor)' : ''}${k.soylu ? ' · soylu' : ''}${c.w.veliaht === k.id ? ' · 👑 veliaht' : ''}`), row);
}

function treeNode(w: World, id: string, depth: number, seen: Set<string>): HTMLElement {
  seen.add(id);
  const p = findPerson(w, id); const k = findChild(w, id);
  const sp = p ? findPerson(w, p.spouse) : undefined;
  const label = `${p ? (p.female ? '👩' : '👨') : k?.female ? '👧' : '👦'} ${nameOf(w, id)}${sp ? ` ⚭ ${sp.name}` : ''}${id === w.kayzerId ? ' 👑' : ''}${w.veliaht === id ? ' (veliaht)' : ''}`;
  const kids = depth < 5 ? childrenOf(w, id).filter((x) => !seen.has(x.id)) : [];
  const el = h('div', { style: `margin-left:${depth ? 14 : 0}px;border-left:${depth ? '2px solid #6b5a3a' : 'none'};padding-left:6px` }, h('div', {}, label));
  for (const x of kids) el.append(treeNode(w, x.id, depth + 1, seen));
  return el;
}

export function familyPanel(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const box = h('div', {}, h('h2', {}, '👪 Aile'));
  if (!me) return box;
  const sp = findPerson(w, me.spouse);
  for (const pr of w.proposals.filter((x) => x.to === me.id)) {
    box.append(h('div', { class: 'card' }, h('b', {}, nameOf(w, pr.from)), pr.kind === 'evlilik' ? ' size evlenme teklif etti 💍' : ' çocuk istiyor 👶',
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'answerProposal', proposalId: pr.id, accept: true }) }, '✔ Kabul'), h('button', { onclick: () => c.act({ t: 'answerProposal', proposalId: pr.id, accept: false }) }, '✖ Ret'))));
  }
  if (sp) {
    const err = canHaveChild(w, me, sp); const preg = w.pregnancies.find((x) => x.parents.includes(me.id));
    box.append(h('div', { class: 'card' }, `💍 Eşiniz: `, h('b', {}, sp.name), ` · hane birikimi ${fmt(me.money + sp.money)} Dinar`,
      preg ? h('div', {}, `🤰 Bebek ${preg.due}. gün doğacak.`) : '',
      h('div', { class: 'row' }, h('button', { class: 'primary', disabled: !!err || !!preg, onclick: () => c.act({ t: 'haveChild' }) }, '👶 Çocuk yap'),
        h('button', { class: 'danger', onclick: () => { if (confirm('Boşanılsın mı? Mallar ikiye bölünür.')) c.act({ t: 'divorce' }); } }, '💔 Boşan')),
      err ? h('div', { class: 'muted' }, `Şimdilik olmaz: ${err}`) : h('div', { class: 'muted' }, `Her çocuk günde ${CHILD_UPKEEP} Dinar bakım ister (okul +1).`)));
  } else box.append(h('div', { class: 'muted' }, 'Bekârsınız. Bir vatandaşın kartını açıp “💍 Evlenme teklif et” diyebilirsiniz. Kayzer’in eşi soylu olur ve saraya taşınır.'));
  const kids = childrenOf(w, me.id);
  box.append(h('h3', {}, `Çocuklar (${kids.length})`));
  for (const k of kids) { const ch = findChild(w, k.id); box.append(ch ? childCard(c, ch) : personLine(c, findPerson(w, k.id)!, ' · yetişkin')); }
  if (!kids.length) box.append(h('div', { class: 'muted' }, `Çocuk için hanede ${PROSPERITY_MONEY}+ Dinar, tok bir hane ve şehirde ekmek bolluğu gerekir.`));
  // family tree: my oldest known ancestor down
  const anc = ancestorsOf(w, me.id); const root = anc[anc.length - 1] ?? me.id;
  box.append(h('h3', {}, '🌳 Soy ağacı'), treeNode(w, root, 0, new Set()));
  const hanedanRoot = w.founderPersonId ?? w.hanedanId;
  if (hanedanRoot && hanedanRoot !== root) box.append(h('h3', {}, '👑 Hanedan'), treeNode(w, hanedanRoot, 0, new Set()));
  const orphans = w.children.filter((x) => x.orphan);
  if (orphans.length) box.append(h('div', { class: 'muted' }, `Devletin baktığı yetimler: ${orphans.map((x) => x.name).join(', ')}`));
  return box;
}

// ---------- İsyan ----------
export function isyanBar(c: Ctx): HTMLElement | null {
  const w = c.w; const i = w.isyan; const me = c.me;
  if (w.deposed && me && w.deposed.voters.includes(me.id)) {
    const box = h('div', { class: 'isyan' }, h('b', {}, `⚖️ Devrik ${nameOf(w, w.deposed.personId)} için kararınız: `));
    for (const f of ['surgun', 'zindan', 'af'] as Fate[]) box.append(h('button', { class: w.deposed.votes[me.id] === f ? 'primary' : '', onclick: () => c.act({ t: 'fateVote', fate: f }) }, FATE_LABEL[f]));
    return box;
  }
  if (!i) return null;
  const s = strength(w); const tot = Math.max(1, s.rebels + s.loyal);
  const meter = h('span', { class: 'bar', style: 'width:140px;background:#2d5b8b' }); const r = h('i'); r.style.width = `${(s.rebels / tot) * 100}%`; r.style.background = '#c8483a'; meter.append(r);
  const box = h('div', { class: 'isyan' }, h('b', {}, `🔥 İSYAN · ${nameOf(w, i.leaderId)}`), ` asi ${s.rebels} `, meter, ` ${s.loyal} sadık · işgal: ${i.occupied.length}/${TARGETS.length}`);
  if (me && (isK(c) || me.prof === 'asker')) {
    box.append(h('button', { onclick: () => c.act({ t: 'isyanCmd', cmd: 'dagit' }) }, '🤝 Dağıt/pazarlık'), h('button', { onclick: () => c.act({ t: 'isyanCmd', cmd: 'tutukla' }) }, '⛓ Elebaşları tutukla'),
      h('button', { class: 'danger', onclick: () => { if (confirm('Askerlere saldırı emri verilsin mi? Kan dökülecek.')) c.act({ t: 'isyanCmd', cmd: 'saldir' }); } }, '⚔️ Saldır'));
  } else if (me && !i.rebels.includes(me.id) && me.id !== w.kayzerId && !me.soylu) box.append(h('button', { onclick: () => c.act({ t: 'joinRebels' }) }, '✊ Asilere katıl'));
  else if (me && i.rebels.includes(me.id)) box.append(' · siz asilerlesiniz ✊');
  box.append(h('div', { class: 'muted', style: 'font-size:12px' }, i.log.slice(-2).join(' · ')));
  return box;
}
