import { trait } from '../sim/piety';
import { GENELGE, GKINDS, type GKind } from '../sim/genelge';
import { rulerName } from '../sim/log';
import { PROPOSE_FEE, CAND_FEE, CAND_ITIBAR, CAND_AGE } from '../sim/meclis';
import { partiesTab, campaignTab } from './campaign';
import { shelf, isPanayir } from '../sim/market2';
import { groupOf } from '../sim/economy';
import { openModal } from './modal';
import { askConfirm } from './modal';
import { electionPhase } from '../sim/tick';
import type { Action, Building, Good, Person, PetitionKind, Profession, World } from '../sim/types';
import { GOODS } from '../sim/types';
import { GOOD_LABEL, PLAYER_PROFS, PROF_LABEL, STATE_PROFS } from '../sim/constants';
import { coupStatus, officeOf } from '../sim/actions';
import { CRIME_LABEL } from '../sim/ai';
import { BILL_LABEL, tally, budgetLeft, MP_ALLOWANCE, ANAYASA_YES, hoursToCount, repealables, turnout, komisyonMembers } from '../sim/meclis';
import type { Bill, BillKind, VoteChoice } from '../sim/types';
import { findPerson } from '../sim/world';
import { bar, fmt, h, select } from './dom';
import { spriteFor } from './sprites';
import { ONLINE_WINDOW_MS } from '../sim/constants';
import { ageText } from '../sim/age';
import { ancestorsOf, canHaveChild, canRule, childrenOf, findChild, heirOf, isHanedan, nameOf, stage, CHILD_UPKEEP, CURE_FEE, PROSPERITY_MONEY } from '../sim/family';
import { FATE_LABEL, strength, TARGETS } from '../sim/isyan';
import type { Child, Fate } from '../sim/types';
import { lawBuilder } from './ruler';
import { myPos } from '../sim/v16';
import { distToBuilding, REACH } from '../sim/move';
import { eatLabel, drinkLabel } from './life';
import { careerBen, jobBoard, kislaWindow } from './career';
import { buildingExtras, caseRoles, electionBlock, personActions, personExtras, sarayExtras } from './life';

export interface Ctx {
  w: World; me: Person | null; founder: boolean;
  act: (a: Action) => void; dm: (personId: string) => void; openPerson: (id: string) => void; openCitizens?: () => void; openLook?: (mode: 'ilk' | 'terzi' | 'berber') => void; atSaray?: boolean; say?: (personId: string, text: string) => void; jobTask?: () => void;
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
    h('div', { class: 'row' }, avatar(p, 72), h('div', {}, h('h2', {}, p.name), h('div', { class: 'muted' }, officeOf(w, p), p.playerId ? ' · oyuncu' : ' · yapay vatandaş', p.jailedDays > 0 ? ' · ⛓ zindanda' : ''), partyBadge(w, p))),
    h('div', { class: 'card' }, `💭 “${p.thought || '…'}”`),
    h('table', {},
      (() => { const an = p.animals; const lbl: Record<string, string> = { inek: 'İnek', koyun: 'Koyun', tavuk: 'Tavuk', at: 'At' }; const txt = an ? Object.entries(an).filter(([, n]) => n > 0).map(([k, n]) => `${lbl[k] ?? k} ${n}`).join(', ') : ''; if (!txt) return ''; const where = p.prof === 'hayvanci' ? 'Hayvan Pazarı ağılında' : p.farm ? 'çiftlikte' : 'evinin kapısında'; return h('tr', {}, h('td', {}, 'Hayvanlar'), h('td', {}, `${txt} (${where}${p.riding && (an?.at ?? 0) > 0 ? ' · atın üstünde' : ''}) `, mine && (an?.at ?? 0) > 0 && p.riding ? h('button', { class: 'sm', onclick: () => c.act({ t: 'ride', on: false }) }, 'İn') : '')); })(),
      h('tr', {}, h('td', {}, 'Kese'), h('td', {}, `${fmt(p.money)} Dinar`)),
      h('tr', { title: 'Kişisel hayat: yemek, aile, eğlence, din' }, h('td', {}, 'Mutluluk'), h('td', {}, bar(p.mood, '#5fae5a'), ` ${Math.round(p.mood)}`)),
      h('tr', { title: 'Devlete ve tahta bakış (eski memnuniyet + sadakat)' }, h('td', {}, 'Memnuniyet'), h('td', {}, bar(p.loyalty, '#e8c14a'), ` ${Math.round(p.loyalty)}`)),
      h('tr', {}, h('td', {}, 'Tokluk / Su (100 = iyi)'), h('td', {}, `${Math.round(100 - p.hunger)} / ${Math.round(100 - p.thirst)}`)),
      h('tr', {}, h('td', {}, 'Sağlık'), h('td', {}, bar(p.health, '#c8483a'), ` ${Math.round(p.health)}`)),
      h('tr', {}, h('td', {}, 'Cumhuriyetçilik'), h('td', {}, bar(p.republic, '#5a8ad0'), ` ${Math.round(p.republic)}`)),
      h('tr', {}, h('td', {}, 'Eşyalar'), h('td', {}, inv)),
      h('tr', {}, h('td', {}, 'Yaş'), h('td', {}, `${ageText(w, p)}${p.soylu ? ' · soylu' : ''}${p.school ? ` · ${p.school} gün okul` : ''}`)),
      ...(p.rank ? [h('tr', {}, h('td', {}, '⚜ Unvan'), h('td', {}, `${p.rank}${p.fief ? ` · tımar: ${w.buildings.find((b) => b.id === p.fief)?.name ?? ''}` : ''}`))] : []),
      h('tr', {}, h('td', {}, 'Eşi'), h('td', {}, findPerson(w, p.spouse)?.name ?? '—')),
      h('tr', {}, h('td', {}, 'Ebeveyn'), h('td', {}, p.parents.map((id) => nameOf(w, id)).join(', ') || '—')),
      h('tr', {}, h('td', {}, 'Çocukları'), h('td', {}, childrenOf(w, p.id).map((k) => nameOf(w, k.id)).join(', ') || '—')),
      h('tr', {}, h('td', {}, 'Son yaptığı'), h('td', {}, p.lastAction)),
      ...(p.task ? [h('tr', { class: 'task-row' }, h('td', {}, '📜 Görevi'), h('td', {}, `${p.task.status === 'yolda' ? '⏳ ' : p.task.status === 'bitti' ? '✅ ' : p.task.status === 'basarisiz' ? '❌ ' : ''}${p.task.label}${p.task.note ? ' – ' + p.task.note : ''} (${findPerson(w, p.task.byId)?.name ?? '?'} istedi)`))] : []),
    ),
    personExtras(c, p),
  );
  if (mine) box.append(careerBen(c, p));
  void friends; void foes;
  if (!c.me || mine) {
    if (mine) box.append(h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'eat' }) }, eatLabel(c.w, p)), h('button', { onclick: () => c.act({ t: 'drinkWater' }) }, drinkLabel(c.w, p)), h('button', { onclick: () => c.act({ t: 'doctor' }) }, '🩺 Hekim')));
    return box;
  }
  const amt = numIn(10, 1);
  const actions = h('div', { class: 'row' }, amt,
    h('button', { onclick: () => c.act({ t: 'give', personId: p.id, amount: Number(amt.value) }) }, isK(c) ? '💰 Saraydan ver' : '💰 Para ver'),
    !isK(c) && !c.me.soylu && (STATE_PROFS.includes(p.prof) || p.meclis) ? h('button', { title: 'Sadece devlet görevlisine ya da Meclis üyesine. Suçtur.', onclick: () => c.act({ t: 'bribe', personId: p.id, amount: Number(amt.value) }) }, '🤫 Rüşvet') : '',
    h('button', { onclick: () => c.dm(p.id) }, '✉️ Mesaj'),
    (c.w.orgs ?? []).some((o) => o.members.includes(c.me!.id)) && !(c.w.orgs ?? []).some((o) => o.members.includes(p.id)) && !p.playerId ? h('button', { title: 'Kabulü fikirlerine, size yakınlığına, verdiğiniz paraya ve riske bağlıdır. Reddeden ihbar edebilir!', onclick: () => { const n = Number(amt.value) || 0; const o = c.w.orgs!.find((x) => x.members.includes(c.me!.id))!; c.say?.(p.id, `Seni gizlice “${o.name}” cemiyetimize davet ediyorum, aramıza katıl.${n > 0 ? ` Sana ${n} Dinar veririm.` : ''}`); } }, '🕯 Cemiyete davet et') : '',
    !c.me.spouse && !p.spouse && p.prof !== 'naip' && stage(w, p) === 'yetiskin' && p.female !== c.me.female ? h('button', { onclick: () => c.act({ t: 'marry', personId: p.id }) }, '💍 Evlenme teklif et') : '',
  );
  box.append(h('h3', {}, 'Ne yapacaksınız?'), actions, personActions(c, p));
  const risky = h('div', { class: 'row' });
  if (!isK(c)) risky.append(h('button', { class: 'danger', onclick: () => { void askConfirm('Çalmak suçtur; bekçi yakalayabilir. Emin misiniz?').then((yes) => { if (yes) c.act({ t: 'steal', personId: p.id }); }); } }, '🦹 Kesesini çal'));
  if (c.me.prof === 'bekci') risky.append(h('button', { onclick: () => c.act({ t: 'arrest', personId: p.id }) }, '⛓ Tutukla'));
  if (isK(c)) {
    const s = select([...STATE_PROFS, ...PLAYER_PROFS].map((x): [string, string] => [x, PROF_LABEL[x]]), p.prof);
    risky.append(s, h('button', { onclick: () => c.act({ t: 'appoint', personId: p.id, prof: s.value as Profession }) }, '📜 Ata'));
  }
  box.append(risky);
  return box;
}

const STAPLE_ROWS: Good[] = ['ekmek', 'su', 'un', 'bugday', 'et', 'balik', 'odun', 'alet', 'kumas', 'elbise'];
/** v2.0.1 buy confirmation: quantity stepper, unit price, total, 'Satın al'. */
function buyDialog(c: Ctx, g: Good, unit: number, stock: number, market: string): void {
  const max = Math.max(1, Math.min(20, stock, c.me ? Math.floor(c.me.money / Math.max(0.01, unit)) : 0)); let q = 1;
  const qb = h('b', {}, '1'); const tot = h('div', { class: 'msg' });
  const upd = (): void => { qb.textContent = String(q); tot.textContent = `${q} × ${unit.toFixed(2)} D = ${(q * unit).toFixed(2)} D (keseniz: ${(c.me?.money ?? 0).toFixed(2)} D)`; };
  const step = (d: number): void => { q = Math.max(1, Math.min(max, q + d)); upd(); };
  upd();
  openModal(`🛒 ${GOOD_LABEL[g]} al`, [h('div', { class: 'muted' }, `Tezgâhta ${stock} adet · en ucuzu ${unit.toFixed(2)} D${market === 'liman' ? ' (Liman toptan)' : ''}`),
    h('div', { class: 'buy-step' }, h('button', { onclick: () => step(-5) }, '−5'), h('button', { onclick: () => step(-1) }, '−'), qb, h('button', { onclick: () => step(1) }, '+'), h('button', { onclick: () => step(5) }, '+5')), tot],
  [{ label: 'Vazgeç', onClick: (close) => close() }, { label: 'Satın al', cls: 'primary', onClick: (close) => { close(); c.act({ t: 'buy', good: g, qty: q, market }); } }]);
}
function marketPanel(c: Ctx, b: Building): HTMLElement {
  const w = c.w; const box = h('div', {});
  const grp = groupOf(b.id); const liman = grp === 'liman';
  if (liman) box.append(h('div', { class: 'muted' }, '⚓ Liman toptancısı malı Çarşı’dan ucuza satar. Burada alıp Pazar’da satabilir ya da Pazar’daki siparişleri teslim edebilirsiniz.'));
  if (isPanayir(w)) box.append(h('div', { class: 'card' }, '🎪 Bugün PANAYIR var: kervanlar geldi, nadir mallar (elbise, mobilya, alet) ucuz.'));
  const goods = GOODS.filter((g) => STAPLE_ROWS.includes(g) || w.listings.some((l) => l.good === g && groupOf(l.market) === grp && (!l.wholesale || liman)));
  const t = h('table', { class: 'mk-table' }, h('tr', {}, h('th', {}, 'Mal'), h('th', {}, 'Fiyat'), h('th', {}, 'Stok'), h('th', {}, 'Elinizde'), h('th', {}, '')));
  for (const g of goods) {
    const sh = shelf(w, g, grp, liman); const out = sh.price === null;
    const tag = liman && w.listings.some((l) => l.good === g && l.wholesale && l.qty > 0) ? h('span', { class: 'mk-tag' }, 'toptan') : '';
    t.append(h('tr', { class: out ? 'out' : '' }, h('td', {}, GOOD_LABEL[g], tag), h('td', {}, out ? h('span', { class: 'mk-out' }, 'Tükendi') : `${sh.price!.toFixed(2)} D`), h('td', {}, String(sh.qty)), h('td', {}, c.me ? String(c.me.inv[g]) : ''),
      h('td', {}, h('button', { class: 'primary', disabled: !c.me || out, onclick: () => buyDialog(c, g, sh.price!, sh.qty, b.id) }, out ? '—' : '🛒 Al'))));
  }
  box.append(t);
  if (!liman && b.id === 'pazar' && (w.orders ?? []).length) {
    box.append(h('h3', {}, '📜 Sipariş ilanları'));
    for (const o of w.orders ?? []) { const by = findPerson(w, o.byId); const can = !!c.me && c.me.inv[o.good] >= o.qty && o.byId !== c.me.id;
      box.append(h('div', { class: 'card row' }, h('div', { style: 'flex:1;min-width:0' }, `“${o.qty} ${GOOD_LABEL[o.good]} getirene ${o.reward} D” – ${by?.name ?? 'Saray'} (son gün ${o.until})`),
        h('button', { class: can ? 'primary' : '', disabled: !can, onclick: () => c.act({ t: 'fulfillOrder', orderId: o.id }) }, can ? 'Teslim et' : `${c.me?.inv[o.good] ?? 0}/${o.qty}`))); }
  }
  if (c.me) {
    const g = select(GOODS.filter((x) => c.me!.inv[x] > 0).map((x): [string, string] => [x, `${GOOD_LABEL[x]} (elde ${c.me!.inv[x]})`]));
    const ref = (x: Good): number => shelf(w, x, 'carsi').price ?? w.prices[x];
    const q = numIn(1, 1, 500); const pr = numIn(Math.round(ref((g.value || 'ekmek') as Good) * 100) / 100, 0.1, 1000, 0.1);
    g.addEventListener('change', () => { pr.value = String(ref(g.value as Good)); });
    const mine = w.listings.filter((l) => l.sellerId === c.me!.id);
    box.append(more(`💰 Mal sat (${liman ? 'Liman' : 'Çarşı'})`, g.options.length ? h('div', { class: 'row' }, g, 'adet', q, 'fiyat', pr, h('button', { onclick: () => c.act({ t: 'sell', good: g.value as Good, qty: Number(q.value), price: Number(pr.value), market: liman ? 'liman' : 'pazar' }) }, 'Tezgâha koy')) : h('div', { class: 'muted' }, 'Satacak malınız yok.'),
      mine.length ? h('div', { class: 'muted' }, 'Tezgâhınız: ' + mine.map((l) => `${GOOD_LABEL[l.good]} ${l.qty}×${l.price.toFixed(2)}`).join(', ')) : ''));
  }
  if (b.id === 'kahve') box.append(more('☕ Kahvehane dedikodusu', ...w.events.slice(-8).reverse().map((e) => h('div', { class: 'msg' }, `Gün ${e.day} ${String(e.hour).padStart(2, '0')}:00 — ${e.text}`))));
  return box;
}
/** Collapsible "more" section to keep panels short. */
export function more(title: string, ...kids: (Node | string)[]): HTMLElement { return h('details', {}, h('summary', {}, title), ...kids); }

function sarayPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  const pending = w.petitions.filter((p) => p.status === 'bekliyor');
  const k = findPerson(w, w.kayzerId);
  box.append(h('div', { class: 'muted' }, w.regime === 'cumhuriyet' ? (k ? `Cumhuriyet. Başkan: ${k.name} (seçim ${w.election.baskanNextDay}. gün). Kanunlar Meclis oyuyla değişir. Hazine: ${fmt(w.treasury)} Dinar.` : `Cumhuriyet ilan edildi. Başkanlık seçimi ${w.election.baskanNextDay}. gün; o zamana kadar Naip Maecenas yönetiyor.`) : k ? `Tahtta: ${k.name}. Hazine: ${fmt(w.treasury)} Dinar. Meclis tekliflerine verdiğiniz veto kesindir, ama halkın gönlünü biraz kırar.` : 'Taht boş.'));
  if (isK(c) && c.openCitizens) box.append(c.atSaray ? h('button', { class: 'primary', onclick: () => c.openCitizens!() }, '📋 Vatandaş defteri (herkesin durumu)') : h('div', { class: 'muted' }, '📋 Vatandaş defterini açmak için Saray’ın içinde/kapısında olmalısınız.'));
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
    const rest = h('div', {}); box.append(more('📜 Fermanlar, maaşlar, kanunlar, veraset… (ayrıntılar Divan’da)', rest));
    rest.append(h('div', { class: 'card' }, `💼 Bütçe: ${w.budget.approved ? 'Meclis onaylı' : 'geçici (onaysız)'} · kalan ${fmt(budgetLeft(w))} / ${fmt(w.budget.limit)} Dinar · ${w.budget.until}. güne kadar. Bayram, bağış, inşaat ödeneği ve büyük yardımlar bütçeden düşer.`));
    const tax = numIn(w.taxRate, 0, 40); const head = numIn(w.headTax, 0, 10, 0.5);
    rest.append(h('h3', {}, '⚖️ Fermanlar'),
      h('div', { class: 'row' }, 'Satış vergisi %', tax, h('button', { onclick: () => c.act({ t: 'setTax', rate: Number(tax.value) }) }, 'Uygula')),
      h('div', { class: 'row' }, 'Baş vergisi (Dinar/gün)', head, h('button', { onclick: () => c.act({ t: 'setHeadTax', amount: Number(head.value) }) }, 'Uygula')),
      h('div', { class: 'muted' }, `Bugün şimdiye kadar: gelir ${fmt(w.dailyIncome)}, gider ${fmt(w.dailyExpense)} Dinar. Son günlerin hazinesi: ${w.stats.slice(-5).map((s) => fmt(s.treasury)).join(' → ') || '—'}`));
    const sal = h('table', {}, h('tr', {}, h('th', {}, 'Görev'), h('th', {}, 'Kişi'), h('th', {}, 'Maaş')));
    for (const pr of STATE_PROFS) {
      const n = numIn(w.salaries[pr] ?? 0, 0, 60);
      sal.append(h('tr', {}, h('td', {}, PROF_LABEL[pr]), h('td', {}, String(w.people.filter((p) => p.prof === pr).length)), h('td', {}, n, h('button', { onclick: () => c.act({ t: 'setSalary', prof: pr, amount: Number(n.value) }) }, '✓'))));
    }
    rest.append(h('h3', {}, '💰 Maaşlar (günlük)'), sal);
    rest.append(h('h3', {}, '📚 Kanunlar'));
    for (const l of w.laws) {
      const p = l.param !== undefined ? numIn(l.param, 0, 100) : null;
      rest.append(h('div', { class: 'card' }, h('b', {}, `${l.active ? '🟢' : '⚪'} ${l.name}`), h('div', { class: 'muted' }, l.desc),
        h('div', { class: 'row' }, p ? l.paramLabel ?? '' : '', p ?? '', h('button', { onclick: () => c.act({ t: 'toggleLaw', lawId: l.id, active: !l.active, param: p ? Number(p.value) : undefined }) }, l.active ? 'Kaldır' : 'Yürürlüğe koy'),
          p ? h('button', { onclick: () => c.act({ t: 'toggleLaw', lawId: l.id, active: l.active, param: Number(p.value) }) }, 'Değeri kaydet') : '')));
    }
    if (k && c.me && k.id === c.me.id && w.regime === 'imparatorluk') {
      const kids = childrenOf(w, k.id); const heir = heirOf(w, k);
      const sel = select([['', 'En büyük çocuk (varsayılan)'], ...kids.map((x): [string, string] => [x.id, `${nameOf(w, x.id)}${x.adult ? '' : ' (reşit değil)'}`])], w.veliaht ?? '');
      rest.append(h('h3', {}, '👑 Veraset'),
        h('div', { class: 'muted' }, `Varis: ${heir ? nameOf(w, heir.id) + (heir.adult ? '' : ' (reşit olana dek eşiniz naip)') : findPerson(w, k.spouse) ? `eşiniz ${findPerson(w, k.spouse)!.name}` : 'yok'}.`),
        h('div', { class: 'row' }, 'Veliaht:', sel, h('button', { onclick: () => c.act({ t: 'veliaht', childId: sel.value || null }) }, 'Belirle')),
        h('button', { class: 'danger', onclick: () => { void askConfirm('Tahttan feragat edilsin mi? Hanedan hakkınız sürer.').then((yes) => { if (yes) c.act({ t: 'abdicate' }); }); } }, '🏳 Tahttan feragat et'));
    }
    rest.append(sarayExtras(c));
    const fest = numIn(150, 50, 5000);
    rest.append(h('h3', {}, '🎉 Bayram'), h('div', { class: 'row' }, fest, 'Dinar', h('button', { onclick: () => c.act({ t: 'festival', cost: Number(fest.value) }) }, 'Bayram ilan et')),
      h('div', { class: 'muted' }, 'Hazineden herkese harçlık dağıtılır; memnuniyet artar, cumhuriyet isteği azalır. (Festival Alanı ayrı: yukarıda.)'));
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
  box.append(h('div', { class: 'muted' }, 'Akış: Bekçi/asker yakalar → (rüşvet penceresi) → Savcı dava açar ya da düşürür → Kadı karar verir. Oyuncular avukat ya da tanık olabilir. Kayzer affedebilir.'));
  box.append(h('h3', {}, `Açık davalar (${open.length})`));
  for (const cs of open) {
    const a = findPerson(w, cs.accusedId);
    const row = h('div', { class: 'row' });
    if (c.me?.prof === 'savci' && cs.stage === 'savci') row.append(h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'kovustur' }) }, 'Kovuştur'), h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'dusur' }) }, 'Düşür'));
    if (c.me?.prof === 'hakim' && cs.stage === 'hakim') row.append(h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'suclu' }) }, 'Suçlu'), h('button', { onclick: () => c.act({ t: 'caseDecision', caseId: cs.id, decision: 'beraat' }) }, 'Beraat'));
    if (isK(c)) row.append(h('button', { onclick: () => c.act({ t: 'pardon', caseId: cs.id }) }, '🕊 Af'));
    box.append(h('div', { class: 'card' }, h('b', {}, `${CRIME_LABEL[cs.crime]}: ${a?.name ?? '?'}`), h('div', { class: 'muted' }, `aşama: ${cs.stage === 'savci' ? 'Savcıda' : 'Kadıda'} · delil ${Math.round(cs.evidence)} · ${cs.amount} Dinar${cs.defenders?.length ? ` · avukat: ${cs.defenders.map((id) => findPerson(w, id)?.name).join(', ')}` : ''}${cs.witnesses?.length ? ` · ${cs.witnesses.length} tanık` : ''}`), row, caseRoles(c, cs.id, cs.accusedId)));
  }
  if (closed.length) box.append(h('h3', {}, 'Son kararlar'), ...closed.map((cs) => h('div', { class: 'msg' }, `${CRIME_LABEL[cs.crime]} – ${findPerson(w, cs.accusedId)?.name ?? '?'}: ${cs.verdict ?? ''} ${cs.sentence ?? ''}`)));
  box.append(h('h3', {}, '📚 Kanun kitabı'), ...w.laws.map((l) => h('div', { class: 'msg' }, `${l.active ? '🟢' : '⚪'} ${l.name}: ${l.desc}`)));
  return box;
}

function kislaPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {}, kislaWindow(c));
  const soldiers = w.people.filter((p) => p.prof === 'asker');
  const avgL = soldiers.reduce((s, p) => s + p.loyalty, 0) / Math.max(1, soldiers.length);
  box.append(h('div', { class: 'muted' }, `${soldiers.length} asker · ortalama sadakat ${Math.round(avgL)}`));
  for (const s of soldiers) box.append(personLine(c, s, h('span', {}, bar(s.loyalty, '#e8c14a'))));
  if (c.me && !isK(c)) {
    box.append(h('h3', {}, '🗡 Komplo'));
    if (w.coup?.leaderId === c.me.id) {
      const st = coupStatus(w, c.me.id); const f = numIn(100, 1);
      box.append(h('div', { class: 'card' }, `${w.coup.kind === 'coup' ? 'Darbe' : 'Devrim'} hazırlığı: asker ${st.soldiers}/${st.need} · fon ${fmt(st.fund)}/${st.fundNeed} · halk desteği ${st.support ? 'VAR' : 'YOK'}`),
        h('div', { class: 'row' }, f, h('button', { onclick: () => c.act({ t: 'fundPlot', amount: Number(f.value) }) }, 'Fona koy'), h('button', { class: 'danger', onclick: () => { void askConfirm(st.ok ? 'Şartlar tamam. Sarayı basıyoruz?' : 'Şartlar TAMAM DEĞİL. Başarısız olursanız tutuklanırsınız. Yine de?').then((yes) => { if (yes) c.act({ t: 'seize' }); }); } }, '⚔️ Sarayı bas'), h('button', { onclick: () => c.act({ t: 'plot', kind: 'none' }) }, 'Vazgeç')),
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
  const card = h('div', { class: 'card' }, h('b', {}, `${BILL_LABEL[b.kind]}: ${b.title}`), h('div', { class: 'muted' }, `Teklif: ${prop?.name ?? '?'} · ${status[b.status]} · ${t.evet} evet · ${t.hayir} hayır · ${t.cekimser} çekimser`));
  if (b.status === 'oylama') card.append(h('div', { class: 'pill warn' }, `⏳ Oylama sürüyor: sayıma ${hoursToCount(w, b)} oyun saati kaldı · yeter sayı ${Math.floor(w.meclis.seats.length / 2) + 1}/${w.meclis.seats.length}`));
  if (b.komisyon) card.append(h('div', { class: `msg ${b.komisyon.ok ? '' : 'warn'}` }, `📊 ${b.komisyon.text}`));
  if (b.kind === 'cumhuriyet' && ['tartisma', 'oylama'].includes(b.status)) card.append(h('div', { class: 'bar' }, h('div', { style: `width:${Math.min(100, t.evet / ANAYASA_YES * 100)}%;background:#c9a227;height:8px` })), h('small', { class: 'muted' }, `${t.evet}/${ANAYASA_YES} evet`));
  if (b.kind === 'cumhuriyet') card.append(h('div', { class: 'muted' }, `🏛 Anayasa oylaması: ${ANAYASA_YES}/16 evet gerekir · parti disiplini yok (vicdan oyu) · Kayzer veto edemez${b.defectors?.length ? ` · çizgiden ayrılan: ${b.defectors.map((id) => findPerson(w, id)?.name ?? '?').join(', ')}` : ''}.`));
  if (open || b.speeches.length) for (const sp of b.speeches.slice(-4)) card.append(h('div', { class: 'msg' }, h('b', {}, findPerson(w, sp.personId)?.name ?? '?'), ': ', sp.text));
  if (!open) {
    const rows = Object.entries(b.votes).map(([id, v]) => `${VOTE_ICON[v]} ${findPerson(w, id)?.name ?? '?'}`);
    if (rows.length) card.append(h('div', { class: 'muted' }, rows.join(' · ')));
  }
  if (open && c.me?.meclis) {
    const mine = b.votes[c.me.id];
    card.append(h('div', { class: 'row' }, ...(['evet', 'hayir', 'cekimser'] as const).map((v) => h('button', { class: mine === v ? 'primary' : '', onclick: () => c.act({ t: 'castVote', billId: b.id, choice: v }) }, `${VOTE_ICON[v]} ${v}`))));
    const sp = h('input', { placeholder: 'Kürsüden konuşun…', maxlength: '200', style: 'flex:1' });
    card.append(h('div', { class: 'row' }, sp, h('button', { onclick: () => { c.act({ t: 'speak', billId: b.id, text: sp.value }); sp.value = ''; } }, '🎤 Konuş')));
  }
  if (b.status === 'onay' && isK(c)) card.append(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'sanction', billId: b.id, approve: true }) }, '✔ Onayla'), h('button', { class: 'danger', onclick: () => { void askConfirm('Veto kesindir ve halkın gönlünü biraz kırar (+0,7 cumhuriyet isteği, −1,5 sadakat). Emin misiniz?').then((yes) => { if (yes) c.act({ t: 'sanction', billId: b.id, approve: false }); }); } }, '✖ Veto')));
  return card;
}

export function pendingSanctions(c: Ctx): HTMLElement[] { return c.w.meclis.bills.filter((b) => b.status === 'onay').map((b) => billCard(c, b, false)); }

export function electionCard(c: Ctx): HTMLElement {
  const w = c.w; const ph = electionPhase(w); const me = c.me; const box = h('div', { class: 'card stack' });
  box.append(h('b', {}, ph.label));
  const isCand = !!me && w.election.candidates.includes(me.id);
  const eligible = !!me && me.prof !== 'asker' && me.prof !== 'bekci' && me.id !== w.kayzerId && me.jailedDays === 0;
  if (ph.phase === 'aday' && me) box.append(isCand ? h('div', { class: 'row' }, h('span', { class: 'pill' }, 'Adaysınız'), h('button', { onclick: () => c.act({ t: 'withdrawCandidacy' } as never) }, 'Adaylıktan çekil')) : eligible ? h('div', { class: 'stack' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'runForMeclis' }) }, `Aday ol (harç ${CAND_FEE} D)`), h('div', { class: 'muted' }, `Şartlar: ${CAND_AGE}+ yaş, itibar ≥ ${CAND_ITIBAR}, ${CAND_FEE} Dinar harç. Milletvekilleri çekilmedikçe otomatik yeniden aday olur.`)) : h('div', { class: 'muted' }, 'Askerler, bekçiler ve Kayzer aday olamaz.'));
  if (ph.phase === 'propaganda' && isCand) box.append(h('button', { onclick: () => c.act({ t: 'poster' } as never) }, 'Afiş as (propaganda)'));
  const cands = w.election.candidates.map((id) => findPerson(w, id)).filter((p): p is NonNullable<typeof p> => !!p);
  if (cands.length) box.append(h('div', { class: 'chips' }, ...cands.map((p) => h('span', { class: 'chip' }, `${p.name} · afiş ${w.election.posters?.[p.id] ?? 0}`, ph.phase === 'oylama' && me && !w.election.votes[me.id] ? h('button', { class: 'sm', title: 'Meclis binasındaki sandıkta', onclick: () => c.act({ t: 'vote', candidateId: p.id }) }, '🗳 Oy ver') : ''))));
  if (ph.phase === 'oylama') { const tu = turnout(w); box.append(h('div', { class: 'msg' }, `🗳 Sandık Meclis binasında açık (08–20). Katılım: ${tu.voted}/${tu.electorate} (%${tu.pct}). Oylar gizlidir.${me && w.election.votes[me.id] ? ' ✔ Oyunuz kaydedildi.' : ''}`)); }
  box.append(h('div', { class: 'muted' }, 'Kim oy verebilir: 16 yaşını doldurmuş, zindanda olmayan herkes (dilenciler dahil). Oy, seçim günü Meclis’teki sandıkta verilir.'));
  const last = w.election.last;
  if (last) box.append(h('details', {}, h('summary', {}, `Son seçim sonuçları (gün ${last.day}) · ${last.voters ?? '?'} seçmen oy verdi / ${last.electorate ?? '?'} (katılım %${last.electorate ? Math.round((last.voters ?? 0) / last.electorate * 100) : 0}) · ilk 16 aday sandalye kazanır (D’Hondt)`), h('table', {}, ...last.results.slice(0, 24).map((r, i) => h('tr', { class: r.won ? 'won' : '' }, h('td', {}, String(i + 1)), h('td', {}, (r as { name?: string }).name || findPerson(w, r.id)?.name || '(vefat etti)'), h('td', {}, `${r.votes} oy`), h('td', {}, r.won ? 'seçildi' : ''))))));
  return box;
}
let meclisTab = 'gundem';
function meclisPanel(c: Ctx): HTMLElement {
  const w = c.w; const root = h('div', { class: 'meclis-full' });
  const govt = (w.meclis.govt ?? []).map((id) => w.meclis.factions.find((f) => f.id === id)?.name).filter(Boolean).join(' + ') || '—';
  root.append(h('div', { class: 'card row', style: 'flex-wrap:wrap;gap:10px' }, h('b', {}, '🏛 Meclis-i Mebusan'), h('span', {}, `💰 Hazine ${Math.round(w.treasury)} D${w.meclis.borc ? ` (borç ${Math.round(w.meclis.borc)})` : ''}`), h('span', {}, `Hükümet: ${govt}`), h('span', {}, `Başkan: ${findPerson(w, w.meclis.baskanId ?? null)?.name ?? '—'}`), h('span', {}, `Devlet: ${rulerName(w)}`), h('span', {}, `Seçim: ${w.election.nextDay}. gün`), h('span', {}, `Komisyon: ${komisyonMembers(w).map((id) => findPerson(w, id)?.name.split(' ').slice(-1)[0] ?? '?').join(', ')}`)));
  const TABS: [string, string][] = [['gundem', 'Gündem'], ['teklif', 'Teklif Ver'], ['gecmis', 'Geçmiş'], ['uyeler', 'Üyeler'], ['partiler', 'Partiler'], ['secim', 'Seçim-Kampanya']];
  const sec: Record<string, HTMLElement> = {}; for (const [k] of TABS) sec[k] = h('div', { class: 'stack', style: k === meclisTab ? '' : 'display:none' });
  const bar = h('div', { class: 'tabs row', style: 'flex-wrap:wrap' }, ...TABS.map(([k, l]) => h('button', { class: k === meclisTab ? 'primary sm' : 'sm', onclick: (e: Event) => { meclisTab = k; for (const [kk] of TABS) sec[kk]!.style.display = kk === k ? '' : 'none'; for (const b of bar.querySelectorAll('button')) b.className = 'sm'; (e.currentTarget as HTMLElement).className = 'primary sm'; } }, l)));
  root.append(bar, ...TABS.map(([k]) => sec[k]!));
  const box = sec.gundem!;
  const fac = (id: string | null) => w.meclis.factions.find((f) => f.id === id);
  if (w.regime === 'cumhuriyet') {
    const b = findPerson(w, w.kayzerId);
    box.append(h('h3', {}, '🗽 Başkanlık'), h('div', { class: 'muted' }, `Başkan: ${b?.name ?? 'yok'} · sonraki Başkanlık seçimi ${w.election.baskanNextDay}. gün (görev süresi 20 gün). Meclis kanunları çoğunlukla çıkarır, Başkanı 2/3 ile azledebilir.`));
    for (const id of w.election.baskanCandidates) { const p = findPerson(w, id); if (p) box.append(personLine(c, p, h('button', { onclick: (e) => { e.stopPropagation(); c.act({ t: 'voteBaskan', candidateId: id }); } }, 'Başkanlığa oy'))); }
    if (c.me) box.append(h('button', { class: 'primary', onclick: () => c.act({ t: 'runForBaskan' }) }, 'Başkan adayı ol'));
  } else box.append(h('div', { class: 'muted' }, 'İmparatorlukta Meclis’in kabul ettiği kararlar Kayzer’in onayına gider. Kayzer’in vetosu kesindir, aşılamaz.'));
  sec.secim!.append(campaignTab(c), electionBlock(c), electionCard(c));
  // seat chart (16 milletvekili)
  const uy = sec.uyeler!;
  uy.append(h('h3', {}, `Sandalyeler (${w.meclis.seats.filter((s) => s.holder).length}/${w.meclis.seats.length}) · üye maaşı ${w.meclis.salary} D/gün`));
  uy.append(h('div', { class: 'seats hemicycle' }, ...w.meclis.seats.map((s) => { const p = findPerson(w, s.holder); const f = fac(p?.faction ?? null);
    return h('div', { class: `seat${p ? '' : ' empty'}${p && p.id === c.me?.id ? ' me' : ''}`, style: `--fc:${f?.color ?? '#555'}`, title: p ? `${p.name} · ${f?.name ?? 'Bağımsız'}` : 'boş', onclick: () => p && c.openPerson(p.id) }, h('b', {}, p?.name.split(' ').slice(-1)[0] ?? '—'), h('small', {}, p ? (f?.name.split(' ')[0] ?? 'Bağımsız') : '')); })));
  const mp = !!c.me?.meclis;
  uy.append(h('div', { class: 'muted' }, `💰 Milletvekili geliri: günlük ${w.meclis.salary} Dinar Meclis maaşı + ${MP_ALLOWANCE} Dinar milletvekili ödeneği (Hazine’den, hesap defterinde görünür).`));
  sec.partiler!.append(partiesTab(c)); // v2.0.2 full party UI (program, axes, support, kasa, Ocak, found/join/leave)
  // agenda: public sessions for everyone; only MPs speak/vote/propose
  const active = w.meclis.bills.filter((b) => ['tartisma', 'oylama', 'onay'].includes(b.status));
  box.append(h('h3', {}, `Gündem (${active.length})${mp ? '' : ' · açık oturum (izleyici)'}`));
  if (!active.length) box.append(h('div', { class: 'muted' }, 'Görüşülen teklif yok.'));
  for (const b of active) box.append(billCard(c, b, mp && b.status !== 'onay'));
  // halk dilekçeleri
  const dil = (w.meclis.dilekceler ?? []).filter((d) => d.status === 'acik');
  box.append(h('h3', {}, `✍ Halk dilekçeleri (${dil.length}) · 20 imza → doğrudan gündem`));
  for (const d of dil) box.append(h('div', { class: 'row card' }, h('span', { class: 'grow' }, `${d.title} · ${findPerson(w, d.by)?.name ?? '?'} · ${d.signers.length}/20 imza · ${d.day + 10}. güne kadar`), c.me && !d.signers.includes(c.me.id) ? h('button', { class: 'sm', title: 'Meclis binasında imzalanır', onclick: () => c.act({ t: 'dilekceImza', id: d.id }) }, 'İmzala') : h('span', { class: 'pill' }, 'imzaladınız')));
  const tk = sec.teklif!;
  const rep = repealables(w);
  tk.append(h('h3', {}, '📜 Yürürlükteki genelge ve kanunlar'), ...(rep.length ? rep.map((r) => h('div', { class: 'msg' }, `${r.name}${r.until ? ` · ${r.until}. güne kadar` : ' · süresiz'}`)) : [h('div', { class: 'muted' }, 'Yürürlükte süreli karar yok.')]));
  { const dk = select((Object.keys(BILL_LABEL) as BillKind[]).filter((k) => k !== 'ozel' && k !== 'cumhuriyet').map((k): [string, string] => [k, BILL_LABEL[k]])); const dt = h('input', { placeholder: 'Hedef (genelge adı, g:… vb.)' }); const dv = numIn(0, 0, 50000);
    tk.append(h('h3', {}, '✍ Halk dilekçesi başlat (herkes, Meclis binasında)'), h('div', { class: 'row' }, dk, dv, dt, h('button', { onclick: () => c.act({ t: 'dilekceAc', kind: dk.value as BillKind, value: Number(dv.value), target: dt.value }) }, 'Dilekçe aç'))); }
  tk.append(h('details', {}, h('summary', {}, '❓ Meclis kuralları'), h('div', { class: 'muted' }, `Yeter sayı: bir kararın geçerli olması için en az ${Math.floor(w.meclis.seats.length / 2) + 1}/${w.meclis.seats.length} milletvekili oy kullanmalı (ör. 16 sandalyede 9). Oylama başlayınca bütün vekillere “Oylama başladı, X saat kaldı” bildirimi gider. 200 D ve üstü harcamalar 3 kişilik Bütçe Komisyonu’ndan (2 iktidar + 1 muhalefet) “Hazine karşılar mı?” raporu alır. Hazinenin karşılayamadığı harcama ancak “Borçlanma” etiketiyle önerilir (dış borç %10 faizle taksitle ödenir). Yürürlükteki genelge/kanun “Kanunu/genelgeyi kaldır” teklifiyle kaldırılır. Halk dilekçesi 20 imzayla doğrudan gündeme girer (10 gün süre). Seçimde oy: 16+ yaş, zindanda olmamak; dilenciler de oy verir.`)));
  if (mp) {
    const kind = select((Object.keys(BILL_LABEL) as BillKind[]).filter((k) => k !== 'ozel').map((k): [string, string] => [k, BILL_LABEL[k]]));
    const val = numIn(10, 0, 50000); const title = h('input', { placeholder: 'Başlık (genelge için metin)', maxlength: '60' });
    const target = select([['', '— hedef —'], ...w.laws.map((l): [string, string] => [l.id, `Kanun: ${l.name}`]), ...GOODS.map((g): [string, string] => [g, `Mal: ${GOOD_LABEL[g]}`]), ['meclis', 'Maaş: Meclis üyesi'], ...STATE_PROFS.map((p): [string, string] => [p, `Maaş: ${PROF_LABEL[p]}`]), ...w.people.filter((p) => STATE_PROFS.includes(p.prof) || p.rank || p.meclis).map((p): [string, string] => [p.id, `Kişi: ${p.rank ? p.rank + ' ' : ''}${p.name}`])]);
    for (const r of rep) target.append(h('option', { value: r.target }, `Kaldır: ${r.name}`));
    const borc = h('input', { type: 'checkbox' }) as HTMLInputElement;
    // v2.0.2 T5: a genelge is picked from the catalogue (real effect, duration, cost) – no Kanun/Mal targets
    const gpick = select(GKINDS.map((k): [string, string] => [k, `${GENELGE[k].label} · ${GENELGE[k].days} gün · ${GENELGE[k].cost} D`])); const ghelp = h('div', { class: 'muted' });
    const syncG = (): void => { const g = kind.value === 'genelge'; gpick.style.display = g ? '' : 'none'; target.style.display = g ? 'none' : ''; val.style.display = g ? 'none' : ''; ghelp.textContent = g ? GENELGE[gpick.value as GKind]?.desc ?? '' : ''; };
    kind.addEventListener('change', syncG); gpick.addEventListener('change', syncG); queueMicrotask(syncG);
    tk.append(h('h3', {}, 'Teklif ver (genelge, vergi, bütçe, gensoru, kaldır…)'), h('div', { class: 'row', style: 'flex-wrap:wrap' }, kind, val, target, gpick, title, h('label', { title: 'Hazine karşılamıyorsa dış borçla' }, borc, ' Borçlanma'), h('button', { class: 'primary', onclick: () => { const g = kind.value === 'genelge'; c.act({ t: 'propose', kind: kind.value as BillKind, value: g ? 0 : Number(val.value), target: g ? gpick.value : target.value, title: title.value || undefined, borc: borc.checked || undefined } as never); title.value = ''; } }, `Teklif et (harç ${PROPOSE_FEE} D)`)), ghelp,
      h('div', { class: 'muted' }, 'Genelge: katalogdan seçilir; kabul edilirse gerçek etkisi süresi boyunca uygulanır, maliyeti hazineden düşer, bitince gazete önce → sonra sonucunu yazar. Gensoru: bir memuru ya da vezir/paşayı görevden alır. Bütçe: Saray’ın harcama sınırı. Kabul edilen kararlar Kayzer’in onayına gider; veto kesindir. Cumhuriyet İlanı (anayasa): 2 gün görüşülür, 14/16 evet ister, parti disiplini uygulanmaz, Kayzer veto edemez; reddedilirse teklif sahibi Kayzer’in gözünden düşer ve 10 gün yeniden verilemez.'),
      h('h3', {}, 'Kanun teklifi (kanun yazıcı)'), lawBuilder(w, 'Meclise sun', (law) => c.act({ t: 'propose', kind: 'ozel', value: law.value, target: law.good ?? '', law })));
  } else tk.append(h('div', { class: 'card muted' }, h('b', {}, 'Meclis bölümü kilitli. '), 'Teklif vermek, kürsüde konuşmak, oy kullanmak ve parti kurmak için milletvekili seçilmelisiniz.'));
  // history
  const done = w.meclis.bills.filter((b) => !['tartisma', 'oylama', 'onay'].includes(b.status)).slice(-8).reverse();
  const gc = sec.gecmis!;
  if (done.length) gc.append(h('h3', {}, '🗳 Oylama geçmişi'), ...done.map((b) => billCard(c, b, false)));
  gc.append(h('h3', {}, '📰 Meclis gazetesi'), ...w.meclis.log.slice(-10).reverse().map((l) => h('div', { class: 'msg' }, `Gün ${l.day}: ${l.text}`)));
  return root;
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
  hayvan: 'Hayvan tüccarı inek, koyun, tavuk ve at satar; çiftlik arsası da buradan alınır. Ahır/kümes ve besleme çiftliğinizde (Buğday Tarlaları) yapılır.',
  okul: 'Öğretmenler çocuklara okuma yazma öğretiyor. Hocalar maaşını hazineden alır.',
  cami: 'Hoca Abdullah’ın camisi. Düğünler avluda yapılır.',
  hekimhane: 'Hekimler ücret karşılığı tedavi eder. Parası olmayana darülaceze (hazine) bakar.',
  liman: 'Balıkçılar her sabah ağ atar; balık çabuk bozulur.',
  kasaphane: 'Kasaplar et keser. Et pahalıdır ama insanı mutlu eder.',
  degirmen: 'Değirmen fırınlara un öğütür.',
  kuyu: 'Sucular kuyudan su çeker. Devlet Suyu kanunu fiyatı sabitler.',
  atolye: 'Terziler kumaş, demirciler alet, marangozlar odun ve mobilya yapar.',
  firin: 'Fırıncılar ekmek pişirir. Buraya askıda ekmek bırakabilirsiniz.',
  zindan: 'Yakalananlar ve hüküm giyenler burada yatar; haritada içeride görünürler.',
  kahve: 'Memurlar ve tahsildarlar burada. Sarraf (borç) ⚡ menüsünde.',
};

function housePanel(c: Ctx, b: Building): HTMLElement {
  const w = c.w; const rs = w.people.filter((p) => p.home === b.id); const owner = findPerson(w, b.ownerId) ?? rs[0]; const me = c.me;
  const box = h('div', { class: 'stack' });
  box.append(h('div', { class: 'row' }, h('span', { class: 'pill' }, `Doluluk ${rs.length}/5`), h('div', { class: 'bar wide' }, h('i', { style: `width:${rs.length * 20}%;background:${rs.length >= 5 ? 'var(--red)' : 'var(--green)'}` })), h('span', { class: 'muted' }, `Ev sahibi: ${owner?.name ?? 'Saray'}`)));
  if (me && me.home === b.id) {
    const inside = (me.homeUntil ?? 0) > (w.serverNow ?? Date.now());
    box.append(h('div', { class: 'muted' }, `Burası sizin eviniz${me.renting === b.id ? ' (kiracı, 4 D/gün)' : ''}. Evdeyken dışarıdan kimse size saldıramaz, soyamaz. Uyku enerji ve sağlık yeniler.`),
      h('div', { class: 'row' }, ...(inside ? [h('button', { class: 'primary', onclick: () => c.act({ t: 'leaveHome' }) }, 'Evden çık')] : [h('button', { class: 'primary', onclick: () => c.act({ t: 'goHome', sleep: false }) }, 'Eve gir'), h('button', { onclick: () => c.act({ t: 'goHome', sleep: true }) }, 'Eve gir ve uyu (sabaha kadar)')])));
  } else if (me && rs.length < 5) box.append(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'buyHome', houseId: b.id }) }, 'Yer satın al (150 D)'), h('button', { onclick: () => c.act({ t: 'rentHome', houseId: b.id }) }, 'Kirala (4 D/gün)')), h('div', { class: 'muted' }, me.home ? 'Taşınırsanız eski evinizdeki yeriniz boşalır.' : 'Eviniz yok: geceleri sokakta kalırsınız ve uyuyamazsınız.'));
  else if (me) box.append(h('div', { class: 'muted' }, 'Bu ev dolu.'));
  return box;
}
export function buildingPanel(c: Ctx, b: Building): HTMLElement {
  const w = c.w;
  let where = '';
  if (c.me) { const pos = myPos(w, c.me, Date.now()); const d = distToBuilding(b, pos); where = d <= REACH ? '📍 Buradasınız.' : `🚶 ${Math.round(d)} adım uzakta – bir şey seçerseniz karakteriniz önce buraya yürür.`; }
  const box = h('div', {}, h('h2', {}, b.name), where ? h('div', { class: 'where' }, where) : '');
  if (b.market || b.id === 'liman') { if (b.id === 'liman' && INFO[b.id]) box.append(h('div', { class: 'muted' }, INFO[b.id]!)); const ex = buildingExtras(c, b); if (ex) box.append(ex); box.append(marketPanel(c, b)); if (b.id === 'pazar') box.append(jobBoard(c, b)); }
  else if (b.id === 'saray') box.append(sarayPanel(c));
  else if (b.id === 'mahkeme') box.append(courtPanel(c));
  else if (b.id === 'kisla') box.append(kislaPanel(c));
  else if (b.id === 'meclis') box.append(meclisPanel(c));
  else if (b.id === 'santiye') box.append(santiyePanel(c));
  else if (b.kind === 'ev') box.append(housePanel(c, b));
  else {
    if (INFO[b.id]) box.append(h('div', { class: 'muted' }, INFO[b.id]!));
    const ex = buildingExtras(c, b); if (ex) box.append(ex);
    if (b.id === 'firin' && c.me) { const q = numIn(3, 1, 20); box.append(h('div', { class: 'row' }, q, h('button', { onclick: () => c.act({ t: 'askida', qty: Number(q.value) }) }, '🥖 Askıda ekmek bırak'))); }
  }
  const people = w.people.filter((p) => (b.id === 'zindan' ? p.jailedDays > 0 : b.kind === 'ev' ? p.home === b.id : p.work === b.id && p.jailedDays === 0));
  if (people.length && b.id !== 'kisla') box.append(more(b.kind === 'ev' ? `Oturanlar (${people.length})` : b.id === 'zindan' ? `Mahkûmlar (${people.length})` : `Burada çalışanlar (${people.length})`, ...people.slice(0, 30).map((p) => personLine(c, p))));
  return box;
}

// ---------- Aile ----------
function childCard(c: Ctx, k: Child): HTMLElement {
  const w = c.w; const st = stage(w, k); const mine = !!c.me && k.parents.includes(c.me.id);
  const row = h('div', { class: 'row' });
  if (mine && st === 'genc') row.append(h('button', { onclick: () => c.act({ t: 'school', childId: k.id, on: !k.inSchool }) }, k.inSchool ? '🏫 Okuldan al' : '🏫 Okula yaz (1 D/gün)'));
  if (mine && k.sick > 0) row.append(h('button', { class: 'primary', onclick: () => c.act({ t: 'cure', childId: k.id }) }, `🩺 Hekime götür (${CURE_FEE} D)`));
  return h('div', { class: 'card' }, h('b', {}, `${k.female ? '👧' : '👦'} ${k.name}`), h('span', { class: 'muted' }, ` · ${ageText(w, k)} (16’sında yetişkin olur)${k.apprentice ? ` · çırak ${k.apprentice} gün` : ''}`),
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
        h('button', { class: 'danger', onclick: () => { void askConfirm('Boşanılsın mı? Mallar ikiye bölünür.').then((yes) => { if (yes) c.act({ t: 'divorce' }); }); } }, '💔 Boşan')),
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
      h('button', { class: 'danger', onclick: () => { void askConfirm('Askerlere saldırı emri verilsin mi? Kan dökülecek.').then((yes) => { if (yes) c.act({ t: 'isyanCmd', cmd: 'saldir' }); }); } }, '⚔️ Saldır'));
  } else if (me && !i.rebels.includes(me.id) && me.id !== w.kayzerId && !me.soylu) box.append(h('button', { onclick: () => c.act({ t: 'joinRebels' }) }, '✊ Asilere katıl'));
  else if (me && i.rebels.includes(me.id)) box.append(' · siz asilerlesiniz ✊');
  box.append(h('div', { class: 'muted', style: 'font-size:12px' }, i.log.slice(-2).join(' · ')));
  return box;
}

/** v2.0.2 U11: party colour badge + trait word next to a person's name. */
function partyBadge(w: World, p: Person): HTMLElement | string {
  const f = p.faction ? w.meclis.factions.find((x) => x.id === p.faction) : undefined; const tr = trait(p);
  if (!f && !tr) return '';
  return h('div', { class: 'row', style: 'gap:6px;margin-top:2px' }, f ? h('span', { class: 'pbadge', style: `background:${f.color}` }, f.name) : '', tr ? h('small', { class: 'muted' }, tr) : '');
}
