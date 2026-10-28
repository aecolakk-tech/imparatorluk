import './ui/style.css';
import type { Action, Person, Profession, World } from './sim/types';
import { GOODS } from './sim/types';
import { GOOD_LABEL, MAP_H, MAP_W, PLAYER_PROFS, PROF_LABEL } from './sim/constants';
import { findPerson } from './sim/world';
import { makeBackend } from './backend';
import type { Backend } from './backend/api';
import { MOCK_FOUNDER_EMAIL } from './backend/mock';
import { buildStatic, drawFrame, hitTest, placePeople, T, type Camera, type Placed } from './ui/map';
import { bar, fmt, h, select } from './ui/dom';
import { avatar, buildingPanel, familyPanel, isyanBar, personCard, type Ctx } from './ui/panels';
import { GUIDE, RULES } from './ui/texts';
import { feedPanel, hudChips, quickPanel } from './ui/life';
import { rulerScreen } from './ui/ruler';
import type { Candidate, ChatMsg } from './server/core';
import { makeSprite } from './ui/sprites';
import { ambience, installClickSounds, isMuted, setMuted, sfx } from './ui/sound';
import { needTarget, myPos } from './sim/v16';
import { findPath, WALK_SPEED, walkEnd, doorSpot, type Pt } from './sim/move';
import { electionDates, electionPhase } from './sim/tick';
import { CRIME_LABEL } from './sim/ai';
import type { Corpse, CourtCase } from './sim/types';
import { avatar as av2 } from './ui/panels';

const app = document.getElementById('app')!;
const be: Backend = makeBackend();
let world: World | null = null;
let stat: HTMLCanvasElement | null = null;
const cam: Camera = { x: 22, y: 8, z: 2.5 };
let placed: Placed[] = [];
let selected: string | null = null;
let sheet: HTMLElement | null = null;
let sheetRender: (() => HTMLElement) | null = null;
let hudEl: HTMLElement; let dockEl: HTMLElement;
let msgs: ChatMsg[] = []; let seenMsgs = 0; let dmTarget: string | null = null;
let skew = 0; // server clock minus client clock, so the map animation never freezes on a wrong local clock
const gameNow = (): number => Date.now() + skew;

function me(): Person | null { const s = be.session(); if (!world || !s) return null; const pl = world.players[s.playerId]; return pl ? findPerson(world, pl.personId) ?? null : null; }
function toast(text: string): void { const t = h('div', { class: 'toast' }, text); app.append(t); setTimeout(() => t.remove(), 2600); }

// ---------------- login ----------------
function loginScreen(): void {
  app.replaceChildren();
  let mode: 'giris' | 'kayit' = 'giris';
  let start_: 'yeni' | 'devral' = 'yeni'; let cands: Candidate[] = []; let pickId: string | null = null; let accessVal = '';
  const box = h('div', { class: 'box' });
  const render = (): void => {
    const email = h('input', { type: 'email', autocomplete: 'email' }); const pw = h('input', { type: 'password', autocomplete: mode === 'giris' ? 'current-password' : 'new-password' });
    const access = h('input', { type: 'password', value: accessVal }); access.addEventListener('input', () => { accessVal = access.value; }); const name = h('input', { maxlength: '24' });
    const prof = select(PLAYER_PROFS.map((p): [string, string] => [p, PROF_LABEL[p]]), 'hamal');
    const err = h('div', { style: 'color:#ff8a7a;min-height:20px;margin-top:6px' });
    const go = async (): Promise<void> => {
      err.textContent = '…';
      if (mode === 'kayit' && start_ === 'devral' && !pickId) { err.textContent = 'Önce devralacağınız vatandaşı seçin.'; return; }
      const e = mode === 'giris' ? await be.login(email.value, pw.value) : await be.register(access.value, email.value, pw.value, name.value, prof.value as Profession, start_ === 'devral' ? pickId : null);
      if (e) { err.textContent = e; return; }
      start();
    };
    box.replaceChildren(
      h('h1', { style: 'margin:0;color:#e8c14a' }, '👑 İmparatorluk'),
      h('div', { class: 'muted' }, 'Davetlilere açık, ortak ve hiç durmayan bir dünya.'),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: mode === 'giris' ? 'primary' : '', onclick: () => { mode = 'giris'; render(); } }, 'Giriş'), h('button', { class: mode === 'kayit' ? 'primary' : '', onclick: () => { mode = 'kayit'; render(); } }, 'Davetle kayıt')),
      ...(mode === 'kayit' ? [h('label', {}, 'Davet şifresi (kurucudan alın)'), access,
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: start_ === 'yeni' ? 'primary' : '', onclick: () => { start_ = 'yeni'; render(); } }, '🏠 Yeni vatandaş'), h('button', { class: start_ === 'devral' ? 'primary' : '', onclick: () => { start_ = 'devral'; render(); } }, '🧑 Var olan birini devral')),
        ...(start_ === 'yeni' ? [h('label', {}, 'Oyundaki adınız'), name, h('label', {}, 'Mesleğiniz'), prof, h('div', { class: 'muted' }, 'Boş bir evde, 40 Dinar ile başlarsınız; ilk 5 gün dokunulmazsınız. Sarraftan borç alabilirsiniz.')] : devralUi()),
      ] : []),
      h('label', {}, 'E-posta (kimseye gösterilmez)'), email, h('label', {}, 'Hesap şifresi (en az 6)'), pw,
      h('div', { style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => void go() }, mode === 'giris' ? 'Giriş yap' : 'Hesap aç ve katıl')), err,
      be.mode === 'mock' ? h('div', { class: 'muted', style: 'margin-top:8px' }, `Yerel deneme modu (sunucusuz). Davet şifresi: “imparator”. İlk kayıt olan ya da ${MOCK_FOUNDER_EMAIL} kurucu (Kayzer) olur. Başka sekmede ikinci bir hesapla ortak dünyayı deneyebilirsiniz.`) : '',
    );
  };
  function devralUi(): HTMLElement[] {
    const load = async (): Promise<void> => { const r = await be.candidates(accessVal); if (typeof r === 'string') { toast(r); return; } cands = r; pickId = null; render(); };
    if (!cands.length) return [h('button', { style: 'margin-top:8px', onclick: () => void load() }, 'Devralınabilir vatandaşları göster'), h('div', { class: 'muted' }, 'Diğer oyuncuların karakterleri ve (kurucu izin vermedikçe) devlet görevlileri listede yoktur.')];
    const sel = select([['', `— ${cands.length} vatandaştan birini seçin —`], ...cands.map((c): [string, string] => [c.id, `${c.name} · ${c.office}`])], pickId ?? '');
    sel.addEventListener('change', () => { pickId = sel.value || null; render(); });
    const out: HTMLElement[] = [h('label', {}, 'Devralacağınız vatandaş'), sel];
    const c = cands.find((x) => x.id === pickId);
    if (c) {
      const fake = { id: c.id, ...c.sprite } as unknown as Person;
      const cv = h('canvas', { class: 'avatar', width: '16', height: '16' }); cv.getContext('2d')!.drawImage(makeSprite(fake)[0]!, 0, 0);
      out.push(h('div', { class: 'card' }, h('div', { class: 'row' }, cv, h('div', {}, h('b', {}, c.name), h('div', { class: 'muted' }, c.office))),
        h('div', {}, `💭 “${c.thought || '…'}”`),
        h('div', { class: 'muted' }, `Kese ${c.money} D · memnuniyet ${c.mood} · sadakat ${c.loyalty} · sağlık ${c.health} · cumhuriyetçilik ${c.republic}${c.spouse ? ` · eşi ${c.spouse}` : ''}`),
        h('div', { class: 'muted' }, 'Hesabı açınca bu kişinin parası, evi, mesleği ve ilişkileri sizin olur.')));
    }
    return out;
  }
  render();
  app.append(h('div', { class: 'login' }, box));
}

// ---------------- game ----------------
const canvas = h('canvas', { id: 'map' });
const ctx2d = canvas.getContext('2d')!;

function ctx(): Ctx {
  return { w: world!, me: me(), founder: !!be.session()?.founder, act: (a) => void doAct(a), dm: (id) => { dmTarget = id; openChat(); }, openPerson: (id) => openPersonSheet(id) };
}
let pending: { a: Action; label: string; since: number; retarget: number } | null = null;
let walkTarget: Pt | null = null;
async function send(a: Action): Promise<void> {
  const r = await be.act(a);
  if (r.msg) toast(r.msg);
  if (!r.ok && r.msg) sfx('error'); else if (a.t === 'buy' || a.t === 'sell' || a.t === 'give' || a.t === 'borrow' || a.t === 'repay') sfx('coins'); else if (a.t === 'kill' && r.ok) sfx('death'); else if (a.t === 'report' && r.ok) sfx('bell');
  await tick(); rerenderSheet();
}
/** Do an action; if it has to be done somewhere else, walk there first (no teleporting). */
async function doAct(a: Action): Promise<void> {
  const m = me(); if (!world || !m) return send(a);
  const nt = needTarget(world, m, a, gameNow());
  if (nt.ok || !nt.to) { pending = null; return send(a); }
  walkTo(nt.to); pending = { a, label: nt.label ?? '', since: Date.now(), retarget: Date.now() };
  toast(`🚶 ${nt.label === 'yanına' ? 'Yanına' : nt.label} yürüyorsunuz…`);
}
function walkTo(to: Pt): void {
  const w = world; const m = me(); if (!w || !m) return;
  if (m.jailedDays > 0) { toast('Zindandasınız.'); return; }
  const now = gameNow(); const from = myPos(w, m, now);
  m.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED }; // local prediction; the server computes the same path
  const pl = Object.values(w.players).find((x) => x.personId === m.id); if (pl) pl.lastSeen = Date.now();
  walkTarget = m.walk.path[m.walk.path.length - 1] ?? to;
  void be.act({ t: 'move', x: to.x, y: to.y });
}
function pendingStep(): void {
  if (!pending || !world) return; const m = me(); if (!m) return;
  const now = gameNow(); const nt = needTarget(world, m, pending.a, now);
  if (nt.ok) { const a = pending.a; pending = null; walkTarget = null; void send(a); return; }
  if (Date.now() - pending.since > 60_000) { pending = null; toast('Hedefe ulaşılamadı.'); return; }
  // following a person who moves: re-path when my walk has ended
  if (nt.to && m.walk && now > walkEnd(m.walk) && Date.now() - pending.retarget > 1500) { pending.retarget = Date.now(); walkTo(nt.to); }
}
function openSheet(render: () => HTMLElement): void {
  sheetRender = render; rerenderSheet(true);
}
function rerenderSheet(force = false): void {
  if (!sheetRender) return;
  if (!force && sheet && (sheet.contains(document.activeElement) && document.activeElement !== document.body)) return; // don't clobber typing
  const scroll = sheet?.scrollTop ?? 0;
  const s = h('div', { class: 'sheet' }, h('button', { class: 'close', onclick: closeSheet }, '✕'), sheetRender());
  if (sheet) sheet.replaceWith(s); else app.append(s);
  sheet = s; if (!force) s.scrollTop = scroll;
}
function closeSheet(): void { sheet?.remove(); sheet = null; sheetRender = null; selected = null; }
function openPersonSheet(id: string): void {
  selected = id;
  openSheet(() => { const p = findPerson(world!, id); return p ? personCard(ctx(), p) : h('div', {}, 'Kişi yok.'); });
}

function modal(content: HTMLElement, onClose?: () => void): void {
  const m = h('div', { class: 'modal' }); const close = (): void => { m.remove(); onClose?.(); };
  m.append(h('div', { class: 'box' }, content, h('div', { style: 'margin-top:12px;text-align:right' }, h('button', { class: 'primary', onclick: close }, 'Tamam'))));
  app.append(m);
}
function maecenas(text: string | HTMLElement): HTMLElement { return h('div', { class: 'maecenas' }, h('div', { class: 'who' }, '🏛'), h('div', {}, h('b', { style: 'color:#e8c14a' }, 'Maecenas'), typeof text === 'string' ? h('pre', { class: 'summary' }, text) : text)); }

function guide(step = 0): void {
  if (step >= GUIDE.length) { localStorage.setItem('imp-guide-done', '1'); return; }
  modal(maecenas(`${GUIDE[step]!}\n\n(${step + 1}/${GUIDE.length})`), () => guide(step + 1));
}

function meter(label: string, v: number, color: string, tip: string, warn = false): HTMLElement {
  return h('span', { class: `stat meter${warn ? ' warn' : ''}`, title: tip }, label, ' ', bar(v, color), h('small', {}, ` ${Math.round(v)}`));
}
function renderHud(): void {
  const w = world; if (!w) return; const m = me();
  const k = findPerson(w, w.kayzerId); const ruler = !!m && w.kayzerId === m.id;
  const chips = hudChips(ctx()); // [clock, meals, water, health, mood, din, ...events]
  const events = chips.slice(m ? 6 : 1);
  hudEl.replaceChildren(
    chips[0]!,
    ...(m ? [
      meter('❤️', m.health, '#c8483a', `Sağlık${m.wounded ? ' – yaralısınız, hekime gidin' : ''}`, m.health < 40 || m.wounded),
      h('span', { class: `stat${m.meals >= 3 ? ' ok' : m.meals < 2 && w.hour > 14 ? ' warn' : ''}`, title: 'Bugünkü öğün (3 gerekir)' }, `🍞 ${m.meals}/3`),
      h('span', { class: `stat${m.drinks >= 5 ? ' ok' : m.drinks < 3 && w.hour > 14 ? ' warn' : ''}`, title: 'Bugünkü su (5 gerekir)' }, `💧 ${m.drinks}/5`),
      meter('😊', m.mood, '#5fae5a', 'Mutluluk'),
      h('span', { class: 'stat', title: 'Keseniz' }, `👛 ${fmt(m.money)}`),
    ] : []),
    ruler ? h('span', { class: 'stat', title: 'Hazine' }, `🏦 ${fmt(w.treasury)}`) : '',
    ruler && w.regime === 'imparatorluk' ? h('span', { class: `stat${w.cumhuriyet > 50 ? ' warn' : ''}`, title: 'Cumhuriyet isteği' }, `🗽 ${Math.round(w.cumhuriyet)}`) : '',
    !ruler ? h('span', { class: 'stat', title: 'Devletin başı' }, w.regime === 'cumhuriyet' ? `🗽 ${k?.name ?? 'seçim'}` : `👑 ${k?.name ?? 'Naip'}`) : '',
    ...events.slice(0, 2),
    h('span', { class: 'grow' }),
    h('button', { class: 'mini', title: isMuted() ? 'Sesi aç' : 'Sesi kapat', onclick: () => { setMuted(!isMuted()); renderHud(); } }, isMuted() ? '🔇' : '🔊'),
  );
  const ib = isyanBar(ctx()); if (ib) hudEl.append(ib);
}

// ---------------- one menu with sections ----------------
type Section = 'yap' | 'ben' | 'mesaj' | 'divan' | 'saray' | 'meclis' | 'aile' | 'gazete' | 'olay' | 'kural' | 'ayar';
let section: Section = (localStorage.getItem('imp-sec') as Section) || 'yap';
function badges(): Partial<Record<Section, number>> {
  const w = world; const m = me(); if (!w || !m) return {};
  const unread = Math.max(0, msgs.length - seenMsgs);
  return { yap: w.offers.filter((o) => o.to === m.id).length + w.arrests.filter((a) => a.status === 'bekliyor' && (a.criminalId === m.id || a.catcherId === m.id)).length, mesaj: unread,
    divan: w.kayzerId === m.id ? w.petitions.filter((p) => p.status === 'bekliyor').length : 0, aile: w.proposals.filter((x) => x.to === m.id).length };
}
function renderDock(): void {
  const b = badges(); const total = Object.values(b).reduce((x, y) => x + (y ?? 0), 0);
  dockEl.replaceChildren(h('button', { class: 'primary menu-btn', onclick: () => openMenu(section) }, '☰ Menü', total ? h('span', { class: 'badge' }, String(total)) : ''));
}
function openMenu(sec: Section): void {
  section = sec; localStorage.setItem('imp-sec', sec); if (sec === 'mesaj') seenMsgs = msgs.length;
  selected = null;
  openSheet(() => {
    const w = world!; const m = me(); const ruler = !!m && w.kayzerId === m.id; const b = badges();
    const tabs: [Section, string][] = [['yap', '⚡ Yap'], ['ben', '👤 Ben'], ['mesaj', '💬 Mesaj'], ...(ruler ? [['divan', w.regime === 'cumhuriyet' ? '🗽 Makam' : '👑 Divan'] as [Section, string]] : []), ['saray', '🏰 Saray'], ['meclis', '🏛 Meclis'], ['aile', '👪 Aile'], ['gazete', '📜 Gazete'], ['olay', '📣 Olaylar'], ['kural', '📖 Kurallar'], ['ayar', '⚙️']];
    const bar_ = h('div', { class: 'tabs' }, ...tabs.map(([id, label]) => h('button', { class: `tab${section === id ? ' on' : ''}`, onclick: () => openMenu(id) }, label, b[id] ? h('span', { class: 'badge' }, String(b[id])) : '')));
    let body: HTMLElement;
    switch (section) {
      case 'yap': body = quickPanel(ctx()); break;
      case 'ben': body = m ? personCard(ctx(), m) : h('div', {}, '—'); break;
      case 'mesaj': body = chatBody(); break;
      case 'divan': body = ruler ? rulerScreen(ctx()) : h('div', {}, '—'); break;
      case 'saray': body = buildingPanel(ctx(), w.buildings.find((x) => x.id === 'saray')!); break;
      case 'meclis': body = buildingPanel(ctx(), w.buildings.find((x) => x.id === 'meclis')!); break;
      case 'aile': body = familyPanel(ctx()); break;
      case 'gazete': body = gazetteBody(); break;
      case 'olay': body = feedPanel(ctx()); break;
      case 'kural': body = h('div', {}, h('h2', {}, '📖 Kurallar ve kullanım'), ...RULES.flatMap(([t, ls]) => [h('details', {}, h('summary', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l)))])); break;
      default: body = h('div', {}, h('h2', {}, '⚙️ Ayarlar'),
        h('div', { class: 'row' }, h('button', { onclick: () => { setMuted(!isMuted()); rerenderSheet(true); } }, isMuted() ? '🔇 Ses kapalı (aç)' : '🔊 Ses açık (kapat)'), h('button', { onclick: () => { closeSheet(); guide(0); } }, '❓ Rehber')),
        be.session()?.founder ? h('button', { onclick: openAdmin }, '🛠 Kurucu paneli') : '',
        h('div', { style: 'margin-top:10px' }, h('button', { class: 'danger', onclick: () => { void be.logout().then(loginScreen); } }, '🚪 Çıkış')));
    }
    return h('div', {}, bar_, body);
  });
}

function gazetteBody(): HTMLElement {
  {
    const w = world!; const box = h('div', {}, h('h2', {}, '📜 İmparatorluk Gazetesi'), h('div', { class: 'muted' }, 'Kalemşörler ve Maecenas her gün yazar.'));
    for (const g of [...w.gazette].reverse().slice(0, 10)) box.append(h('div', { class: 'card' }, h('b', {}, `Gün ${g.day}: ${g.headline}`), ...g.lines.map((l) => h('div', { class: 'muted' }, l)), ...(g.meclis?.length ? [h('div', { class: 'muted', style: 'margin-top:4px' }, '🏛 Meclis:'), ...g.meclis.map((l) => h('div', { class: 'muted' }, `• ${l}`))] : [])));
    if (!w.gazette.length) box.append(h('div', { class: 'muted' }, 'İlk sayı gün sonunda çıkacak.'));
    box.append(h('h3', {}, 'Bugün olanlar'), ...w.events.slice(-12).reverse().map((e) => h('div', { class: 'msg' }, `${String(e.hour).padStart(2, '0')}:00 ${e.text}`)));
    return box;
  }
}
function openChat(): void { openMenu('mesaj'); }
function chatBody(): HTMLElement {
  const w = world!; const meP = me();
  const to = dmTarget ? findPerson(w, dmTarget) : null;
  const list = h('div', { class: 'msgs' });
  const shown = msgs.filter((m) => (to ? (m.toPersonId === to.id && m.fromPersonId === meP?.id) || (m.fromPersonId === to.id && m.toPersonId === meP?.id) : m.toPersonId === null));
  for (const m of shown.slice(-60)) { const npc = findPerson(w, m.fromPersonId); const mine = m.fromPersonId === meP?.id; list.append(h('div', { class: `msg${m.toPersonId ? ' dm' : ''}${mine ? ' mine' : ''}` }, h('b', { style: 'cursor:pointer', onclick: () => openPersonSheet(m.fromPersonId) }, m.fromName), npc && !npc.playerId ? h('span', { class: 'muted' }, ' (NPC)') : '', ': ', m.text)); }
  if (!shown.length) list.append(h('div', { class: 'muted' }, to ? `${to.name} ile henüz konuşmadınız. Bir şey yazın; kendi aklıyla cevap verir.` : 'Meydan sessiz.'));
  if (typing) list.append(h('div', { class: 'muted typing' }, `${to?.name ?? 'Biri'} yazıyor…`));
  const inp = h('input', { maxlength: '280', placeholder: to ? `${to.name}'a yazın… (örn. merhaba, nasılsın?)` : 'Meydanda herkese duyurun…', style: 'flex:1' });
  const sendMsg = async (): Promise<void> => {
    const text = inp.value; if (!text.trim()) return; inp.value = ''; typing = !!dmTarget;
    msgs.push({ id: `local-${Date.now()}`, fromPersonId: meP?.id ?? '', fromName: meP?.name ?? '', toPersonId: dmTarget, text, at: Date.now() }); rerenderSheet(true);
    const e = await be.chat(text, dmTarget); typing = false;
    if (e) { toast(e); sfx('error'); }
    msgs = await be.messages(); seenMsgs = msgs.length; if (msgs.at(-1)?.fromPersonId !== meP?.id) sfx('msg'); rerenderSheet(true);
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('.chat-input'); el?.focus(); }, 30);
  };
  inp.classList.add('chat-input');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') void sendMsg(); });
  const dms = [...new Set(msgs.filter((m) => m.toPersonId && (m.fromPersonId === meP?.id || m.toPersonId === meP?.id)).map((m) => (m.fromPersonId === meP?.id ? m.toPersonId! : m.fromPersonId)))];
  if (dmTarget && !dms.includes(dmTarget)) dms.unshift(dmTarget);
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  return h('div', {}, h('div', { class: 'row' }, h('button', { class: to ? '' : 'primary', onclick: () => { dmTarget = null; rerenderSheet(true); } }, '🗣 Meydan (dedikodu)'), ...dms.slice(0, 8).map((id) => h('button', { class: dmTarget === id ? 'primary' : '', onclick: () => { dmTarget = id; rerenderSheet(true); } }, `✉️ ${findPerson(w, id)?.name ?? '?'}`))),
    list, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void sendMsg() }, 'Gönder')),
    h('div', { class: 'muted' }, to ? 'Özel mesaj: yalnızca siz ve o görür.' : 'Meydan herkese açıktır; NPC’ler buraya sadece herkesin duymasını istedikleri dedikoduları yazar. Birine özel yazmak için kişiye dokunun → 💬 Konuş.'));
}
let typing = false;

function openAdmin(): void {
  openSheet(() => {
    const w = world!; const box = h('div', {}, h('h2', {}, '🛠 Kurucu paneli (gizli)'));
    const run = async (r: Parameters<Backend['admin']>[0]): Promise<void> => { toast(await be.admin(r)); await tick(); rerenderSheet(true); };
    const pw = h('input', { type: 'text', placeholder: 'yeni davet şifresi' });
    box.append(h('h3', {}, 'Davet şifresi'), h('div', { class: 'row' }, pw, h('button', { onclick: () => void run({ t: 'setPassword', password: pw.value }) }, 'Değiştir')));
    const pt = h('table', {}, h('tr', {}, h('th', {}, 'Oyuncu'), h('th', {}, 'Son görülme'), h('th', {}, '')));
    for (const p of Object.values(w.players)) pt.append(h('tr', {}, h('td', {}, `${p.name}${p.founder ? ' 👑' : ''}${p.banned ? ' (sürgün)' : ''}`), h('td', {}, new Date(p.lastSeen).toLocaleString('tr-TR')),
      h('td', {}, p.founder ? '' : h('button', { onclick: () => void run({ t: 'kick', playerId: p.playerId }) }, 'At'), ' ', p.founder ? '' : h('button', { class: 'danger', onclick: () => void run({ t: 'ban', playerId: p.playerId, banned: !p.banned }) }, p.banned ? 'Affet' : 'Sürgün et'))));
    box.append(h('h3', {}, 'Oyuncular'), pt);
    const tr = h('input', { type: 'number', value: String(Math.round(w.treasury)) });
    box.append(h('h3', {}, 'Değer düzelt'), h('div', { class: 'row' }, 'Hazine', tr, h('button', { onclick: () => void run({ t: 'setTreasury', amount: Number(tr.value) }) }, 'Ayarla')));
    const who = select(w.people.map((p): [string, string] => [p.id, p.name]));
    const field = select([['money', 'Para'], ['mood', 'Memnuniyet'], ['loyalty', 'Sadakat'], ['republic', 'Cumhuriyetçilik'], ['hunger', 'Açlık'], ['jailedDays', 'Zindan günü'], ['name', 'İsim']]);
    const val = h('input', { placeholder: 'değer' });
    box.append(h('div', { class: 'row' }, who, field, val, h('button', { onclick: () => void run({ t: 'editPerson', personId: who.value, field: field.value as 'money', value: field.value === 'name' ? val.value : Number(val.value) }) }, 'Kaydet')),
      h('div', { class: 'row' }, h('button', { onclick: () => void run({ t: 'allowStateTakeover', allow: !w.allowStateTakeover }) }, w.allowStateTakeover ? '🔓 Devlet görevlileri devralınabilir (kapat)' : '🔒 Devlet görevlileri devralınamaz (aç)')),
      h('div', { class: 'row' }, h('button', { onclick: () => void run({ t: 'releaseAll' }) }, 'Zindanı boşalt'), h('button', { onclick: () => void run({ t: 'resetCumhuriyet' }) }, 'Cumhuriyet isteğini sıfırla')));
    const snapBox = h('div', {}, h('div', { class: 'muted' }, 'yükleniyor…'));
    void be.snapshots().then((ss) => { snapBox.replaceChildren(...(ss.length ? ss.map((s) => h('div', { class: 'row card' }, `Gün ${s.day} · ${new Date(s.at).toLocaleString('tr-TR')}`, h('button', { class: 'danger', onclick: () => { if (confirm('Dünya bu yedeğe dönecek. Emin misiniz?')) void run({ t: 'restoreSnapshot', id: s.id }); } }, 'Geri yükle'))) : [h('div', { class: 'muted' }, 'Henüz yedek yok.')])); });
    box.append(h('h3', {}, 'Yedekler (3 günde bir otomatik, son 8)'), h('button', { onclick: () => void run({ t: 'snapshot' }) }, 'Şimdi yedek al'), snapBox);
    return box;
  });
}

// ---------------- input: pan / zoom / tap ----------------
const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
let pinch: { d: number; z: number } | null = null;
function clampCam(): void {
  const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T);
  const top = ((hudEl?.offsetHeight ?? 48) * (window.devicePixelRatio || 1)) / (cam.z * T) + 2.2; // room above the top row so the info bar never hides buildings
  cam.x = Math.max(-2, Math.min(MAP_W - vw + 2, cam.x)); cam.y = Math.max(-top, Math.min(MAP_H - vh + 2, cam.y));
}
function zoomAt(sx: number, sy: number, nz: number): void {
  const z0 = cam.z; nz = Math.max(1, Math.min(5, nz));
  const wx = cam.x + sx / (z0 * T), wy = cam.y + sy / (z0 * T);
  cam.z = nz; cam.x = wx - sx / (nz * T); cam.y = wy - sy / (nz * T); clampCam();
}
function setupInput(): void {
  const dpr = (): number => window.devicePixelRatio || 1;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; else { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam.z }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); zoomAt((a!.x + b!.x) / 2 * dpr(), (a!.y + b!.y) / 2 * dpr(), pinch.z * d / pinch.d); if (dragStart) dragStart.moved = true; return; }
    if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.abs(dx) + Math.abs(dy) > 6) dragStart.moved = true; cam.x = dragStart.cx - dx * dpr() / (cam.z * T); cam.y = dragStart.cy - dy * dpr() / (cam.z * T); clampCam(); }
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0 && dragStart) {
      if (!dragStart.moved && world) {
        const r = canvas.getBoundingClientRect(); const hit = hitTest(world, placed, cam, (e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr());
        const tx = (e.clientX - r.left) * dpr() / (cam.z * T) + cam.x, ty = (e.clientY - r.top) * dpr() / (cam.z * T) + cam.y;
        if (hit.corpse) openCorpse(hit.corpse.id);
        else if (hit.sign) openElectionSign();
        else if (hit.person && hit.person.id !== me()?.id) openPersonSheet(hit.person.id);
        else if (hit.person) openMenu('ben');
        else if (hit.building) { const b = hit.building; selected = null; pending = null; walkTo(doorSpot(b)); sfx('door'); openSheet(() => buildingPanel(ctx(), b)); }
        else { pending = null; closeSheet(); walkTo({ x: tx, y: ty }); sfx('step'); }
      }
      dragStart = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr(), cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const resize = (): void => { canvas.width = Math.round(innerWidth * dpr()); canvas.height = Math.round(innerHeight * dpr()); clampCam(); };
  addEventListener('resize', resize); resize();
}

function darkness(w: World): number {
  const t = w.hour; if (t >= 21 || t < 5) return 0.45; if (t >= 19) return (t - 19) / 2 * 0.45; if (t < 7) return (7 - t) / 2 * 0.45; return 0;
}

let lastHud = 0;
function frame(): void {
  if (world && stat) {
    const now = gameNow();
    placed = placePeople(world, now);
    drawFrame(ctx2d, stat, world, cam, placed, now, selected, me()?.id ?? null, darkness(world), walkTarget);
    pendingStep();
    if (walkTarget) { const m = me(); if (m?.walk && now > walkEnd(m.walk) + 300 && !pending) walkTarget = null; }
    if (now - lastHud > 1000) { lastHud = now; renderHud(); soundscape(); }
  }
  requestAnimationFrame(frame);
}

let ticking = false;
async function tick(): Promise<void> {
  if (ticking || !be.session()) return; ticking = true;
  try {
    const r = await be.heartbeat();
    const first = !world; world = r.world;
    if (world.serverNow) skew = world.serverNow - Date.now();
    if (first) { stat = buildStatic(world); const m = me(); const b = m ? world.buildings.find((x) => x.id === m.home) : undefined; if (b) { cam.x = b.x - canvas.width / (cam.z * T) / 2; cam.y = b.y - canvas.height / (cam.z * T) / 2; clampCam(); } }
    if (r.summary) modal(maecenas(r.summary));
    renderDock(); events(first); trialPopup();
  } catch (e) { console.warn('heartbeat', e); } finally { ticking = false; }
}

async function start(): Promise<void> {
  app.replaceChildren(canvas); hudEl = h('div', { class: 'hud' }); dockEl = h('div', { class: 'dock' }); app.append(hudEl, dockEl); installClickSounds(app);
  setupInput();
  await tick();
  if (!localStorage.getItem('imp-guide-done')) guide(0);
  setInterval(() => void tick(), be.mode === 'mock' ? 2500 : 6000);
  setInterval(() => { void be.messages().then((m) => { msgs = m; renderDock(); }); }, 5000);
  setInterval(() => rerenderSheet(), 4000);
  requestAnimationFrame(frame);
}

// ---------------- corpses, election notices, trials, sounds ----------------
function openCorpse(id: string): void {
  openSheet(() => {
    const w = world!; const co = (w.corpses ?? []).find((c) => c.id === id); if (!co) return h('div', {}, 'Ceset kaldırıldı.');
    const left = Math.max(0, Math.round((co.at + 5 * 60_000 - gameNow()) / 1000));
    const st = co.stage === 'yerde' ? 'Kimse ihbar etmedi.' : co.stage === 'ihbar' ? `${findPerson(w, co.bekciId)?.name ?? 'Bekçi'} olay yerine geliyor.` : co.note ?? 'İnceleniyor.';
    return h('div', {}, h('h2', {}, `💀 ${co.name}`), h('div', { class: 'card' }, `Kanlar içinde yerde yatıyor. ${st}`), h('div', { class: 'muted' }, `Ceset ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} sonra kaldırılacak.`),
      co.stage === 'yerde' ? h('button', { class: 'primary', onclick: () => void doAct({ t: 'report', corpseId: co.id }) }, '☎ Bekçiye ihbar et') : '');
  });
}
function electionInfo(w: World): HTMLElement {
  const d = electionDates(w); const ph = electionPhase(w);
  const row = (k: string, label: string, days: string): HTMLElement => h('tr', { class: ph.phase === k ? 'on' : '' }, h('td', {}, label), h('td', {}, days));
  return h('div', {}, h('h2', {}, '🗳 Meclis Seçim Tabelası'), h('div', { class: 'muted' }, `Bugün ${w.day}. gün. ${ph.label}.`),
    h('table', { class: 'sign' }, row('aday', '1. Adaylık', `${d.adayFrom}–${d.adayTo}. gün (Meclis’e gidip aday olun)`), row('propaganda', '2. Propaganda', `${d.propFrom}–${d.propTo}. gün (afiş, meydan konuşması)`), row('oylama', '3. Seçim', `${d.vote}. gün (Meclis ya da Meydan’daki sandık)`)),
    h('div', { class: 'muted' }, `Askerler ve bekçiler aday olamaz. ${w.election.seats} sandalye. Adaylar: ${w.election.candidates.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ') || 'henüz yok'}.`));
}
function openElectionSign(): void { openSheet(() => electionInfo(world!)); }
let lastCorpses = new Set<string>(); let lastJail = 0; let lastIsyan = false;
function events(first: boolean): void {
  const w = world; const m = me(); if (!w) return;
  // election phase notifications (once per phase)
  const ph = electionPhase(w).phase; const key = `${w.election.nextDay}:${ph}`;
  if (!first && localStorage.getItem('imp-phase') !== key && ph !== 'bekleme') {
    const msg = ph === 'aday' ? 'Meclis seçimi için ADAYLIK açıldı! Aday olmak isteyen Meclis’e gitsin.' : ph === 'propaganda' ? 'PROPAGANDA dönemi başladı: adaylar afiş asıyor, meydanda konuşuyor.' : 'BUGÜN SEÇİM GÜNÜ! Sandık Meclis’te ve Meydan’da.';
    modal(h('div', {}, h('h2', {}, '🔔 Meclis'), h('p', {}, msg), electionInfo(w))); sfx('bell');
  }
  localStorage.setItem('imp-phase', key);
  const cs = new Set((w.corpses ?? []).map((c) => c.id));
  if (!first) for (const id of cs) if (!lastCorpses.has(id)) { sfx('death'); const co = w.corpses!.find((c) => c.id === id)!; toast(`💀 ${co.name} öldürüldü!`); }
  lastCorpses = cs;
  if (m) { if (m.jailedDays > 0 && lastJail === 0 && !first) sfx('prison'); lastJail = m.jailedDays; }
  if (!!w.isyan !== lastIsyan && !first && w.isyan) sfx('drums'); lastIsyan = !!w.isyan;
}
function soundscape(): void {
  const w = world; if (!w) return;
  if (w.isyan) ambience('isyan'); else if ((w.festivalUntil ?? 0) >= w.day && w.hour >= 12 && w.hour < 22) ambience('festival');
  else if (w.hour >= 5 && w.hour < 10) ambience('sabah'); else if (w.hour >= 19 && w.hour < 23) ambience('aksam'); else if (w.hour >= 23 || w.hour < 5) ambience('gece'); else ambience('gun');
}
let trialEl: HTMLElement | null = null; let trialSeen = localStorage.getItem('imp-trial-seen') ?? '';
function trialPopup(): void {
  const w = world; const m = me(); if (!w || !m) return;
  const c: CourtCase | undefined = w.cases.find((x) => x.trial && (x.accusedId === m.id || x.trial.judgeId === m.id || x.trial.prosecutorId === m.id) && (!x.trial.done || trialSeen !== x.id));
  if (!c?.trial) { trialEl?.remove(); trialEl = null; return; }
  if (trialEl?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') { const n = trialEl.querySelectorAll('.msg').length; if (n === c.trial.msgs.length) return; }
  const tr = c.trial; const role = (id: string | null, label: string): HTMLElement => { const p = findPerson(w, id); return h('div', { class: 'role' }, p ? av2(p, 56) : h('div', { class: 'avatar' }), h('b', {}, label), h('div', { class: 'muted' }, p?.name ?? '—')); };
  const acc = findPerson(w, c.accusedId);
  const left = Math.max(0, Math.round((tr.until - gameNow()) / 1000));
  const list = h('div', { class: 'msgs' }, ...tr.msgs.map((x) => h('div', { class: `msg ${x.who}` }, h('b', {}, `${x.who === 'hakim' ? '⚖ ' : x.who === 'savci' ? '📜 ' : '🙋 '}${x.name}`), ': ', x.text)));
  if (tr.pending) list.append(h('div', { class: 'muted typing' }, 'Kadı düşünüyor…'));
  const inp = h('input', { maxlength: '300', placeholder: 'Kendinizi savunun… (tanık, mazeret, pişmanlık)', style: 'flex:1' });
  const go = async (): Promise<void> => { const t = inp.value; if (!t.trim()) return; inp.value = ''; await send({ t: 'defense', caseId: c.id, text: t }); trialPopup(); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') void go(); });
  const box = h('div', { class: 'box trial' }, h('h2', {}, `⚖ Duruşma: ${CRIME_LABEL[c.crime]} – ${acc?.name ?? ''}`),
    h('div', { class: 'roles' }, role(tr.judgeId, 'Kadı'), role(tr.prosecutorId, 'Savcı'), role(c.accusedId, 'Sanık')), list,
    tr.done ? h('div', { class: 'card verdict' }, h('b', {}, tr.verdictText ?? 'Karar verildi.'), h('div', { style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: () => { trialSeen = c.id; localStorage.setItem('imp-trial-seen', c.id); trialEl?.remove(); trialEl = null; } }, 'Tamam')))
      : c.accusedId === m.id ? h('div', {}, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void go() }, 'Savun')), h('div', { class: 'row' }, h('span', { class: 'muted' }, `Kalan süre ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · en fazla 5 söz`), h('button', { onclick: () => void send({ t: 'restCase', caseId: c.id }) }, 'Savunmam bitti, karar verilsin')))
        : h('div', { class: 'muted' }, 'Duruşmayı izliyorsunuz.'));
  const wasDone = trialEl?.dataset.done === '1';
  const el = h('div', { class: 'modal trial-modal' }, box); el.dataset.done = tr.done ? '1' : '0';
  if (trialEl) trialEl.replaceWith(el); else { app.append(el); sfx('gavel'); }
  trialEl = el; if (tr.done && !wasDone) sfx('gavel');
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
}
void ({} as Corpse);

void be.restore().then((s) => (s ? start() : loginScreen()));
// expose for headless smoke tests
(window as unknown as { __imp: () => unknown }).__imp = () => ({ world, me: me()?.name, goods: GOODS.map((g) => GOOD_LABEL[g]), avatar: !!avatar, placed: placed.map((q) => [q.p.id, q.x, q.y, q.visible]), toScreen: (x: number, y: number) => { const r = canvas.getBoundingClientRect(); return [r.left + (x - cam.x) * cam.z * T / (window.devicePixelRatio || 1), r.top + (y - cam.y) * cam.z * T / (window.devicePixelRatio || 1)]; } });
