import './ui/style.css';
import type { Action, Person, Profession, World } from './sim/types';
import { GOODS } from './sim/types';
import { GOOD_LABEL, MAP_H, MAP_W, PLAYER_PROFS, PROF_LABEL } from './sim/constants';
import { findPerson } from './sim/world';
import { makeBackend } from './backend';
import type { Backend } from './backend/api';
import { MOCK_FOUNDER_EMAIL } from './backend/mock';
import { buildStatic, drawFrame, hitTest, placePeople, T, tapFx, type Camera, type Placed } from './ui/map';
import { bar, fmt, h, select } from './ui/dom';
import { ic, CREDITS, iconify, installIconify } from './ui/icons';
import { electionCard, avatar, buildingPanel, familyPanel, isyanBar, personCard, type Ctx } from './ui/panels';
import { GUIDE, RULES } from './ui/texts';
import { feedPanel, hudChips, quickPanel } from './ui/life';
import { rulerScreen } from './ui/ruler';
import type { Candidate, ChatMsg } from './server/core';
import { makeSprite } from './ui/sprites';
import { GOALS } from './sim/goals';
import { season, SEASON_LABEL, ANIMALS, ANIMAL_LABEL, ANIMAL_PRICE, ANIMAL_FEED, FARM_PRICE, BARN, RANKS_N, RANK_INFO, FIEFS, ORG_LABEL, ORG_GOAL, orgGoalProgress, ROLE_LABEL, type OrgRole, type OrgKind, type Rank } from './sim/realm';
import type { GoalId } from './sim/types';
import { ambience, installClickSounds, isMuted, setMuted, sfx, musicOn, setMusic } from './ui/sound';
import { needTarget, myPos } from './sim/v16';
import { findPath, WALK_SPEED, walkEnd, doorSpot, distToBuilding, REACH, PERSON_REACH, type Pt } from './sim/move';
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
let msgs: ChatMsg[] = []; let seenMsgs = 0; let dmTarget: string | null = null; let pendingSay: string | null = null;
let skew = 0; // server clock minus client clock, so the map animation never freezes on a wrong local clock
const gameNow = (): number => Date.now() + skew;

function me(): Person | null { const s = be.session(); if (!world || !s) return null; const pl = world.players[s.playerId]; return pl ? findPerson(world, pl.personId) ?? null : null; }
function toast(text: string): void { document.querySelectorAll('.toast').forEach((x) => x.remove()); const t = h('div', { class: 'toast' }, text); app.append(t); setTimeout(() => t.classList.add('out'), 2300); setTimeout(() => t.remove(), 2600); }
/** Floating action feedback over the map (e.g. +12 D, -5 D). */
function floatText(text: string, cls = ''): void { if (lowGfx) return; const el = h('div', { class: `float-text ${cls}` }, text); document.body.append(el); setTimeout(() => el.remove(), 1300); }

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
  return { w: world!, me: me(), founder: !!be.session()?.founder, act: (a) => void doAct(a), dm: (id) => { dmTarget = id; openChat(); }, openPerson: (id) => openPersonSheet(id), openCitizens: () => openCitizens(), atSaray: atSaray(), say: (id, text) => { dmTarget = id; pendingSay = text; openChat(); } };
}
let pending: { a: Action; label: string; since: number; retarget: number } | null = null;
let walkTarget: Pt | null = null;
let lowGfx = localStorage.getItem('imp-lowgfx') === '1';
let localWalk: { walk: NonNullable<Person['walk']>; id: string } | null = null; // client-side prediction wins over older server copies
let followCam = true; let lastMoveSent = 0; let moveTimer: ReturnType<typeof setTimeout> | null = null; let pendingOpen: string | null = null; let openTries = 0;
function atSaray(): boolean { const w = world; const m = me(); const b = w?.buildings.find((x) => x.id === 'saray'); return !!(w && m && b && w.kayzerId === m.id && distToBuilding(b, myPos(w, m, gameNow())) <= REACH + 0.6); }
async function send(a: Action): Promise<void> {
  const before = me()?.money ?? 0;
  const r = await be.act(a);
  if (r.msg) toast(r.msg);
  if (r.ok) { await tick(); const d = Math.round(((me()?.money ?? 0) - before) * 10) / 10; if (Math.abs(d) >= 0.5) floatText(`${d > 0 ? '+' : ''}${d} D`, `coin${d < 0 ? ' neg' : ''}`); else floatText('✓'); }
  if (!r.ok && r.msg) sfx('error'); else if (a.t === 'buy' || a.t === 'sell' || a.t === 'give' || a.t === 'borrow' || a.t === 'repay') sfx('coins'); else if (a.t === 'kill' && r.ok) sfx('death'); else if (a.t === 'report' && r.ok) sfx('bell');
  if (!r.ok) await tick(); rerenderSheet();
}
/** Do an action; if it has to be done somewhere else, walk there first (no teleporting). */
async function doAct(a: Action): Promise<void> {
  const m = me(); if (!world || !m) return send(a);
  const nt = needTarget(world, m, a, gameNow());
  if (nt.ok || !nt.to) { pending = null; return send(a); }
  walkTo(nt.to); pending = { a, label: nt.label ?? '', since: Date.now(), retarget: Date.now() };
  toast(`${nt.label === 'yanına' ? 'Yanına' : nt.label} yürüyorsunuz…`);
}
function walkTo(to: Pt): void {
  const w = world; const m = me(); if (!w || !m) return;
  if (m.jailedDays > 0) { toast('Zindandasınız.'); return; }
  const now = gameNow(); const from = myPos(w, m, now);
  m.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED * (m.riding && (m.animals?.at ?? 0) > 0 ? 1.5 : 1) }; // local prediction; the server computes the same path
  localWalk = { walk: m.walk, id: m.id }; followCam = true; if (!lowGfx) { tapFx.x = to.x; tapFx.y = to.y; tapFx.t = performance.now(); }
  const pl = Object.values(w.players).find((x) => x.personId === m.id); if (pl) pl.lastSeen = Date.now();
  walkTarget = m.walk.path[m.walk.path.length - 1] ?? to;
  // throttle server syncs: at most one move per 400 ms, the last target wins
  const sendMove = (): void => { lastMoveSent = Date.now(); moveTimer = null; void be.act({ t: 'move', x: to.x, y: to.y }); };
  if (moveTimer) clearTimeout(moveTimer);
  const wait = 400 - (Date.now() - lastMoveSent); if (wait <= 0) sendMove(); else moveTimer = setTimeout(sendMove, wait);
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
  const s = h('div', { class: 'sheet' }, h('button', { class: 'close icon', title: 'Kapat', onclick: closeSheet }, ic('close')), sheetRender());
  if (sheet) sheet.replaceWith(s); else { s.classList.add('enter'); app.append(s); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('enter'))); }
  sheet = s; if (!force) s.scrollTop = scroll;
}
function closeSheet(): void { const s = sheet; if (s) { s.classList.add('leave'); setTimeout(() => s.remove(), lowGfx ? 0 : 200); } sheet = null; sheetRender = null; selected = null; }
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

const SEASON_IC: Record<string, string> = { ilkbahar: 'spring', yaz: 'summer', sonbahar: 'autumn', kis: 'winter' };
function renderHud(): void {
  const w = world; if (!w) return; const m = me();
  const k = findPerson(w, w.kayzerId); const ruler = !!m && w.kayzerId === m.id;
  const chips = hudChips(ctx()); // [clock, meals, water, health, mood, din, ...events]
  const events = chips.slice(m ? 6 : 1);
  const night = w.hour < 6 || w.hour >= 21;
  const chip = (icon: string, text: string, tip: string, cls = ''): HTMLElement => h('span', { class: `stat${cls ? ' ' + cls : ''}`, title: tip }, ic(icon), h('span', {}, text));
  hudEl.replaceChildren(
    h('div', { class: 'hud-l' },
      chip(night ? 'moon' : 'sun', `Gün ${w.day} · ${String(w.hour).padStart(2, '0')}:00`, '1 oyun günü = 6 gerçek dakika (1x)'),
      chip(SEASON_IC[season(w)]!, SEASON_LABEL[season(w)].replace(/^\S+\s/, ''), 'Mevsim'),
      ...(m ? [
        meterI('heart', m.health, 'var(--red)', `Sağlık${m.wounded ? ' – yaralısınız, hekime gidin' : ''}`, m.health < 40 || m.wounded, 'hp'),
        meterI('bread', 100 - m.hunger, 'var(--gold)', `Tokluk – açlık ${Math.round(m.hunger)}/100`, m.hunger >= 85, 'hunger'),
        meterI('water', 100 - m.thirst, 'var(--blue)', `Su – susuzluk ${Math.round(m.thirst)}/100`, m.thirst >= 85, 'thirst'),
        meterI('moon', m.energy ?? 80, '#b59cf0', `Enerji ${Math.round(m.energy ?? 80)}/100 – evinizde uyuyarak yenilenir`, (m.energy ?? 80) < 15, 'energy'),
        chip('coin', fmt(m.money), 'Keseniz'),
      ] : []),
      ruler ? chip('castle', fmt(w.treasury), 'Hazine') : '',
      ruler && w.regime === 'imparatorluk' ? chip('banner', String(Math.round(w.cumhuriyet)), 'Cumhuriyet isteği', w.cumhuriyet > 50 ? 'warn' : '') : '',
      !ruler ? chip('crown', w.regime === 'cumhuriyet' ? (k?.name ?? 'seçim') : (k?.name ?? 'Naip'), 'Devletin başı') : '',
      ...events.slice(0, 1)),
    h('div', { class: 'hud-r' },
      ruler ? h('span', { class: 'speed seg', title: 'Oyun hızı (Kayzer, her yerden)' }, ...[0.5, 1, 2].map((s) => h('button', { class: `mini${w.speed === s ? ' on' : ''}`, onclick: () => { void send({ t: 'setSpeed', speed: s }); } }, `${s === 0.5 ? '½' : s}x`))) : '',
      h('button', { class: `mini icon${musicOn() ? ' on' : ''}`, title: musicOn() ? 'Müziği kapat' : 'Müziği aç', onclick: () => { setMusic(!musicOn()); renderHud(); } }, ic('music')),
      h('button', { class: 'mini icon', title: isMuted() ? 'Sesi aç' : 'Sesi kapat', onclick: () => { setMuted(!isMuted()); renderHud(); } }, ic(isMuted() ? 'mute' : 'sound'))),
  );
  const ib = isyanBar(ctx()); if (ib) hudEl.append(ib);
  iconify(hudEl); needAlerts(m);
}
function meterI(icon: string, v: number, color: string, tip: string, warn: boolean, key: string): HTMLElement {
  return h('span', { class: `stat meter${warn ? ' warn' : ''}${flashKey === key && performance.now() < flashUntil ? ' flash' : ''}`, title: tip, 'data-k': key }, ic(icon), bar(v, color));
}
// v1.9: hunger / thirst alarms – one popup + vibration per threshold crossing (≤15 left), with a cooldown
let flashKey = ''; let flashUntil = 0; const alarmArmed: Record<string, boolean> = { hunger: true, thirst: true }; const alarmAt: Record<string, number> = { hunger: -1e9, thirst: -1e9 };
function needAlerts(m: ReturnType<typeof me>): void {
  if (!m) return;
  for (const key of ['hunger', 'thirst'] as const) {
    const left = 100 - (key === 'hunger' ? m.hunger : m.thirst);
    if (left > 25) alarmArmed[key] = true; // re-arm once the bar is refilled
    if (left <= 15 && alarmArmed[key] && performance.now() - alarmAt[key]! > 90_000) {
      alarmArmed[key] = false; alarmAt[key] = performance.now(); flashKey = key; flashUntil = performance.now() + 4000;
      const msg = key === 'hunger' ? `Açlığınız kritik! Tokluk ${Math.round(left)}’e düştü – bir şeyler yiyin.` : `Susuzluğunuz kritik! Su ${Math.round(left)}’e düştü – su için.`;
      alertPop(key === 'hunger' ? 'bread' : 'water', msg, key);
      try { navigator.vibrate?.([180, 90, 180]); } catch { /* not supported */ }
      sfx('error'); setTimeout(renderHud, 4100);
    }
  }
}
function alertPop(icon: string, text: string, key: string): void {
  document.querySelector('.alert-pop')?.remove();
  const el = h('div', { class: `alert-pop ${key}`, role: 'alert' }, h('span', { class: 'big' }, ic(icon)), h('div', { class: 'grow' }, h('b', {}, key === 'hunger' ? 'Açlık' : 'Susuzluk'), h('div', {}, text)),
    h('button', { class: 'primary sm', onclick: () => { el.remove(); void send({ t: key === 'hunger' ? 'eat' : 'drinkWater' } as never); } }, key === 'hunger' ? 'Ye' : 'Su iç'), h('button', { class: 'sm', onclick: () => el.remove() }, ic('close')));
  document.body.append(el); setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 7600);
}

// ---------------- one menu with sections ----------------
type Section = 'yap' | 'hedef' | 'cemiyet' | 'soylu' | 'ben' | 'mesaj' | 'divan' | 'aile' | 'gazete' | 'ayar' | 'saray' | 'meclis' | 'tarih' | 'olay' | 'kural';
let section: Section = (localStorage.getItem('imp-sec') as Section) || 'yap';
function badges(): Partial<Record<Section, number>> {
  const w = world; const m = me(); if (!w || !m) return {};
  const unread = Math.max(0, msgs.length - seenMsgs);
  return { yap: w.offers.filter((o) => o.to === m.id).length + w.arrests.filter((a) => a.status === 'bekliyor' && (a.criminalId === m.id || a.catcherId === m.id)).length, mesaj: unread,
    divan: w.kayzerId === m.id ? w.petitions.filter((p) => p.status === 'bekliyor').length : 0, aile: w.proposals.filter((x) => x.to === m.id).length };
}
function renderDock(): void {
  const b = badges(); const total = Object.values(b).reduce((x, y) => x + (y ?? 0), 0);
  dockEl.replaceChildren(h('button', { class: 'primary menu-btn', onclick: () => openMenu(section) }, ic('menu'), h('span', {}, 'Menü'), total ? h('span', { class: 'badge' }, String(total)) : ''));
}
function openMenu(sec: Section): void {
  section = sec; localStorage.setItem('imp-sec', sec); if (sec === 'mesaj') seenMsgs = msgs.length;
  selected = null;
  openSheet(() => {
    const w = world!; const m = me(); const ruler = !!m && w.kayzerId === m.id; const b = badges();
    const tabs: [Section, string, string][] = [['yap', 'bolt', 'Yap'], ['ben', 'person', 'Ben'], ['hedef', 'goal', 'Hedef'], ['cemiyet', 'candle', 'Cemiyet'], ...(ruler ? [['soylu', 'noble', 'Soylular'] as [Section, string, string], ['divan', w.regime === 'cumhuriyet' ? 'banner' : 'crown', w.regime === 'cumhuriyet' ? 'Makam' : 'Divan'] as [Section, string, string]] : []), ...(m?.meclis ? [['meclis', 'scales', 'Meclis'] as [Section, string, string]] : []), ['mesaj', 'talk', 'Mesaj'], ['aile', 'family', 'Aile'], ['gazete', 'scroll', 'Haberler'], ['ayar', 'cog', 'Ayarlar']];
    if (!tabs.some((t) => t[0] === section)) section = 'yap';
    const bar_ = h('div', { class: 'tabs' }, ...tabs.map(([id, icon, label]) => h('button', { class: `tab${section === id ? ' on' : ''}`, onclick: () => openMenu(id) }, ic(icon), h('span', {}, label), b[id] ? h('span', { class: 'badge' }, String(b[id])) : '')));
    let body: HTMLElement;
    switch (section) {
      case 'yap': { body = quickPanel(ctx()); const mm = me(); if (mm && (mm.inv.sut > 0 || mm.inv.yumurta > 0)) body.append(h('div', { class: 'row' }, mm.inv.sut > 0 ? h('button', { onclick: () => void send({ t: 'drinkMilk' }) }, ic('milk'), ` Süt iç (${mm.inv.sut})`) : '', mm.inv.yumurta > 0 ? h('button', { onclick: () => void send({ t: 'eatEgg' }) }, ic('egg'), ` Yumurta ye (${mm.inv.yumurta})`) : '')); if (mm && mm.home && mm.home.startsWith('ev')) body.append(h('div', { class: 'row' }, h('button', { onclick: () => void doAct({ t: 'goHome', sleep: true }) }, ic('moon'), ' Eve git, uyu'))); else if (mm && !mm.home) body.append(h('div', { class: 'card muted' }, 'Eviniz yok. Boş yeri olan bir eve dokunun: yer satın alın ya da kiralayın.'));
        if ((mm?.animals?.at ?? 0) > 0) body.append(h('div', { class: 'row' }, h('button', { onclick: () => void send({ t: 'ride', on: !mm!.riding }) }, ic('horse'), mm!.riding ? ' Attan in' : ' Ata bin'))); break; }
      case 'ben': body = m ? personCard(ctx(), m) : h('div', {}, '—'); break;
      case 'mesaj': body = chatBody(); break;
      case 'hedef': body = goalsBody(); break;
      case 'cemiyet': body = orgsBody(); break;
      case 'soylu': body = ruler ? noblesBody() : h('div', {}, '—'); break;
      case 'tarih': body = historyBody(); break;
      case 'divan': body = ruler ? rulerScreen(ctx()) : h('div', {}, '—'); break;
      case 'saray': body = bPanel(w.buildings.find((x) => x.id === 'saray')!); break;
      case 'meclis': body = buildingPanel(ctx(), w.buildings.find((x) => x.id === 'meclis')!); break;
      case 'aile': body = familyPanel(ctx()); break;
      case 'gazete': body = h('div', { class: 'stack' }, gazetteBody(), h('details', {}, h('summary', {}, 'Son olaylar'), feedPanel(ctx())), h('details', {}, h('summary', {}, 'Tarih Kitabı'), historyBody())); break;
      case 'olay': body = feedPanel(ctx()); break;
      case 'kural': body = h('div', {}, h('h2', {}, '📖 Kurallar ve kullanım'), ...RULES.flatMap(([t, ls]) => [h('details', {}, h('summary', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l)))])); break;
      default: body = h('div', { class: 'stack' }, h('h2', {}, 'Ayarlar'),
        h('div', { class: 'row' }, h('button', { onclick: () => { lowGfx = !lowGfx; localStorage.setItem('imp-lowgfx', lowGfx ? '1' : '0'); document.body.classList.toggle('low', lowGfx); dispatchEvent(new Event('resize')); rerenderSheet(true); } }, lowGfx ? 'Düşük grafik: AÇIK' : 'Düşük grafik: kapalı'), h('button', { onclick: () => { closeSheet(); guide(0); } }, 'Rehber')),
        be.session()?.founder ? h('button', { onclick: openAdmin }, 'Kurucu paneli') : '',
        h('h3', {}, 'Kurallar ve kullanım'), ...RULES.map(([t, ls]) => h('details', {}, h('summary', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l)))),
        h('h3', {}, 'Emeği geçenler'), h('div', { class: 'muted' }, CREDITS),
        h('div', {}, h('button', { class: 'danger', onclick: () => { void be.logout().then(loginScreen); } }, 'Çıkış')));
    }
    return h('div', {}, bar_, body);
  });
}

function bPanel(b: import('./sim/types').Building): HTMLElement {
  const box = buildingPanel(ctx(), b);
  if (b.id === 'saray' || b.id === 'okul') box.append(h('button', { onclick: () => openSheet(historyBody) }, '📖 Tarih Kitabı’nı oku'));
  if (b.id === 'ciftlik') box.append(farmBody());
  if (b.id === 'hayvan') box.append(animalMarketBody());
  return box;
}
function historyBody(): HTMLElement {
  const w = world!; const box = h('div', {}, h('h2', {}, '📖 Tarih Kitabı'), h('div', { class: 'muted' }, 'Saltanatlara göre şehrin büyük olayları (kanunlar, savaşlar, isyanlar, evlilikler, ölümler, seçimler, unvanlar).'));
  const hist = w.history ?? []; if (!hist.length) { box.append(h('div', { class: 'muted' }, 'Henüz yazılmış bir şey yok.')); return box; }
  const reigns: string[] = []; for (const e of hist) if (!reigns.includes(e.reign)) reigns.push(e.reign);
  const icon: Record<string, string> = { kanun: '📜', isyan: '🔥', evlilik: '💍', olum: '⚰', secim: '🗳', savas: '⚔', dogum: '👶', doga: '🌾', unvan: '⚜', orgut: '🕯', entrika: '🕵', baslangic: '📖' };
  for (const r of [...reigns].reverse()) { const es = hist.filter((e) => e.reign === r); box.append(h('details', { open: r === reigns[reigns.length - 1] ? '' : null } as never, h('summary', {}, `👑 ${r} (gün ${es[0]!.day}–${es[es.length - 1]!.day}, ${es.length} olay)`), ...[...es].reverse().slice(0, 150).map((e) => h('div', { class: 'msg' }, `${icon[e.kind] ?? '•'} Gün ${e.day}: ${e.text}`)))); }
  return box;
}
function orgsBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', {}, h('h2', {}, '🕯 Gizli cemiyetler')); if (!m) return box;
  const mine = (w.orgs ?? []).find((o) => o.members.includes(m.id)); const ruler = w.kayzerId === m.id;
  box.append(h('div', { class: 'muted' }, 'Hırsızlar loncası, cumhuriyet cemiyeti ya da tarikat kurun veya katılın. Büyüdükçe ve gece toplandıkça şüphe artar: muhbirler, casuslar, baskınlar, ev aramaları ve sorgular sizi ele verebilir.'));
  if (mine) {
    const ld = mine.leaderId === m.id;
    box.append(h('div', { class: 'card' }, h('b', {}, `${ORG_LABEL[mine.kind]} – “${mine.name}”`), h('div', {}, `Lider: ${findPerson(w, mine.leaderId)?.name ?? '—'} · ${mine.members.length} üye · şüphe `, bar(mine.suspicion, '#c8483a'), ` ${Math.round(mine.suspicion)}${mine.known ? ' · ⚠️ Saray biliyor!' : ''}`),
      h('div', {}, `🎯 Hedef: ${ORG_GOAL[mine.kind]} `, bar(orgGoalProgress(w, mine), '#6fbf73'), ` %${Math.round(orgGoalProgress(w, mine))}${mine.kind === 'hirsiz' ? ` · kasa ${Math.round(mine.funds ?? 0)} D` : ''}`),
      h('h3', {}, 'Üyeler ve roller'),
      ...mine.members.map((id) => { const p = findPerson(w, id); if (!p) return ''; const r = mine.roles?.[id] ?? (id === mine.leaderId ? 'lider' : 'uye');
        const sel = ld && id !== m.id ? select((['yardimci', 'propagandaci', 'casus', 'uye'] as OrgRole[]).map((x): [string, string] => [x, ROLE_LABEL[x]])) : null; if (sel) { sel.value = r; sel.onchange = () => void send({ t: 'orgRole', personId: id, role: sel.value as OrgRole }); }
        return h('div', { class: 'row member' }, h('span', { class: 'grow', style: 'cursor:pointer', onclick: () => openPersonSheet(id) }, `${p.name} · ${PROF_LABEL[p.prof]}${p.jailedDays > 0 ? ' · zindanda' : ''}`), sel ?? h('span', { class: 'pill' }, ROLE_LABEL[r])); }),
      h('div', { class: 'muted' }, 'Yeni üye: birine 1 adım yaklaşın, kartından “Cemiyete davet et” deyin (yanına para da koyabilirsiniz). Üyeleriniz de tanıdıklarını kazanmaya çalışır.'),
      h('h3', {}, 'Eylemler'),
      h('div', { class: 'row' }, h('button', { onclick: () => void send({ t: 'orgAct', deed: 'propaganda' }) }, 'Propaganda (5 D)'),
        mine.kind === 'hirsiz' ? h('button', { onclick: () => void send({ t: 'orgAct', deed: 'hirsizlik' }) }, 'Zengini soy') : h('button', { onclick: () => void send({ t: 'orgAct', deed: 'sabotaj' }) }, 'Sabotaj'),
        mine.kind !== 'hirsiz' ? h('button', { class: 'danger', onclick: () => { if (confirm('Ayaklanma başlatılsın mı? Geri dönüşü yok.')) void send({ t: 'orgAct', deed: 'ayaklanma' }); } }, 'Ayaklanma') : '',
        ld ? h('button', { onclick: () => void send({ t: 'orgMeet' }) }, 'Gece toplantısı') : '', h('button', { class: 'danger', onclick: () => void send({ t: 'orgLeave' }) }, 'Ayrıl'))));
  } else if (!ruler) {
    const kind = select((Object.keys(ORG_LABEL) as OrgKind[]).map((k): [string, string] => [k, ORG_LABEL[k]])); const nm = h('input', { placeholder: 'Örgütün adı' });
    box.append(h('h3', {}, 'Kur'), h('div', { class: 'row' }, kind, nm, h('button', { class: 'primary', onclick: () => void send({ t: 'orgFound', kind: kind.value as OrgKind, name: nm.value }) }, 'Kur')));
    const heard = (w.orgs ?? []).filter((o) => o.members.some((id) => (findPerson(w, id)?.relations[m.id] ?? 0) > 10) || o.known);
    box.append(h('h3', {}, 'Fısıltıyla duyduklarınız'), ...(heard.length ? heard.map((o) => h('div', { class: 'card row' }, h('span', { class: 'grow' }, `${ORG_LABEL[o.kind]} – “${o.name}” (${o.members.length} üye)`), h('button', { onclick: () => void send({ t: 'orgJoin', orgId: o.id }) }, 'Katıl'))) : [h('div', { class: 'muted' }, 'Kimse size bir şey fısıldamadı. Dost edinin.')]));
  }
  if (ruler) {
    const known = (w.orgs ?? []).filter((o) => o.known);
    box.append(h('h3', {}, '🕵 Saray’ın bildikleri'), ...(known.length ? known.map((o) => h('div', { class: 'card' }, h('b', {}, `${ORG_LABEL[o.kind]} – “${o.name}”`), h('div', { class: 'muted' }, `Bilinen üyeler: ${o.knownMembers.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ') || '—'}`), h('button', { class: 'danger', onclick: () => void doAct({ t: 'raidOrg', orgId: o.id }) }, '⚔ Askerlerle baskın (emir)'))) : [h('div', { class: 'muted' }, 'Bilinen gizli örgüt yok. Casus atayın, muhbir ödülü koyun.')]));
  }
  return box;
}
function noblesBody(): HTMLElement {
  const w = world!; const box = h('div', {}, h('h2', {}, '⚜ Soylular, casuslar ve adalet'));
  const nobles = w.people.filter((p) => p.rank);
  box.append(h('div', { class: 'muted' }, RANKS_N.map((r) => `${r}: ${RANK_INFO[r].stipend} D/gün – ${RANK_INFO[r].duty}`).join(' · ')));
  box.append(h('h3', {}, 'Unvanlılar'), ...(nobles.length ? nobles.map((p) => h('div', { class: 'card row' }, h('span', { class: 'grow' }, `${p.rank} ${p.name}${p.fief ? ` · tımar: ${w.buildings.find((b) => b.id === p.fief)?.name}` : ''} · gözde `, bar(p.favor ?? 50, '#e8c14a'), ` · sadakat ${Math.round(p.loyalty)}`), h('button', { class: 'danger', onclick: () => void doAct({ t: 'stripTitle', personId: p.id }) }, 'Unvanı al'))) : [h('div', { class: 'muted' }, 'Henüz unvan verilmedi.')]));
  const cand = w.people.filter((p) => p.prof !== 'naip' && p.id !== w.kayzerId).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const who = select(cand.map((p): [string, string] => [p.id, `${p.name} (${PROF_LABEL[p.prof]})`])); const rk = select(RANKS_N.map((r): [string, string] => [r, r])); const ff = select([['', 'Tımar (Bey için)'], ...FIEFS.map((f): [string, string] => [f, w.buildings.find((b) => b.id === f)?.name ?? f])]);
  box.append(h('h3', {}, 'Unvan ver'), h('div', { class: 'row' }, who, rk, ff, h('button', { class: 'primary', onclick: () => void doAct({ t: 'grantTitle', personId: who.value, rank: rk.value as Rank, fief: ff.value || null }) }, 'Ver')));
  const spy = select(cand.filter((p) => !p.playerId || p.npc).map((p): [string, string] => [p.id, p.name])); const tgt = select(cand.map((p): [string, string] => [p.id, p.name]));
  box.append(h('h3', {}, '🕵 Casus ata (5 gün, 15 D)'), h('div', { class: 'row' }, spy, '→', tgt, h('button', { onclick: () => void doAct({ t: 'assignSpy', spyId: spy.value, targetId: tgt.value }) }, 'İzlet')),
    h('div', { class: 'muted' }, `Aktif casuslar: ${(w.spies ?? []).map((s) => `${findPerson(w, s.spyId)?.name} → ${findPerson(w, s.targetId)?.name}`).join(', ') || '—'}`));
  const wt = select(cand.map((p): [string, string] => [p.id, p.name]));
  box.append(h('h3', {}, '📜 Arama emri'), h('div', { class: 'row' }, wt, h('button', { onclick: () => void doAct({ t: 'warrant', personId: wt.value }) }, 'Emir çıkar'), h('button', { onclick: () => void doAct({ t: 'searchHouse', personId: wt.value }) }, '🔎 Evi ara (bekçilerle)')),
    h('div', { class: 'muted' }, `Bekleyen emirler: ${(w.warrants ?? []).map((id) => findPerson(w, id)?.name).join(', ') || '—'}`));
  const pay = h('input', { type: 'number', value: String(w.informantPay ?? 0), style: 'width:80px' });
  box.append(h('h3', {}, '🗝 Muhbir ödülü'), h('div', { class: 'row' }, pay, h('button', { onclick: () => void doAct({ t: 'informantPay', amount: Number(pay.value) }) }, 'İlan et')));
  return box;
}
function animalMarketBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', { class: 'stack' }, h('h3', {}, ic('cow'), ' Hayvan Pazarı')); if (!m) return box;
  const seller = w.people.find((p) => p.prof === 'hayvanci');
  box.append(h('div', { class: 'muted' }, `${seller ? `Tüccar: ${seller.name}. ` : ''}Hayvanlar ağılda; aldığınız hayvan çiftliğinize gider.`));
  box.append(h('table', { class: 'prices' }, ...ANIMALS.map((a) => h('tr', {}, h('td', {}, ic(ANIMAL_ICON[a]!), ' ', ANIMAL_LABEL[a]), h('td', {}, `${ANIMAL_PRICE[a]} D`), h('td', { class: 'muted' }, ANIMAL_INFO[a]), h('td', {}, h('button', { class: 'sm', onclick: () => void doAct({ t: 'buyAnimal', animal: a }) }, 'Satın al'))))));
  if (!m.farm) box.append(h('button', { class: 'primary', onclick: () => void doAct({ t: 'buyFarm' }) }, ic('farm'), ` Çiftlik arsası al (${FARM_PRICE} D)`));
  return box;
}
function farmBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', { class: 'stack' }, h('h3', {}, ic('farm'), ' Çiftliğiniz')); if (!m) return box;
  if (!m.farm) { box.append(h('div', { class: 'muted' }, 'Çiftliğiniz yok. Hayvan Pazarı’ndan bir arsa alın.')); return box; }
  const hd = m.animals ?? { inek: 0, koyun: 0, tavuk: 0, at: 0 }; const bn = m.barn ?? { ahir: 0, kumes: 0 };
  const feed = Math.ceil(ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0)); const st = m.farmStock ?? {};
  box.append(h('div', { class: 'chips' }, ...ANIMALS.map((a) => h('span', { class: 'chip' }, ic(ANIMAL_ICON[a]!), ` ${hd[a]}`)), h('span', { class: 'chip' }, `Ahır ${bn.ahir} · Kümes ${bn.kumes}`)));
  box.append(h('div', { class: 'row' }, h('button', { onclick: () => void doAct({ t: 'buildBarn', kind: 'ahir' }) }, `Ahır yap (${BARN.ahir.cost} D)`), h('button', { onclick: () => void doAct({ t: 'buildBarn', kind: 'kumes' }) }, `Kümes yap (${BARN.kumes.cost} D)`)));
  box.append(h('div', { class: 'row' }, h('button', { class: m.fedDay === w.day ? '' : 'primary', disabled: feed === 0 || m.fedDay === w.day, onclick: () => void doAct({ t: 'feedAnimals' }) }, m.fedDay === w.day ? 'Bugün beslendi' : `Yem ver (${feed} buğday)`),
    h('button', { onclick: () => void doAct({ t: 'collectFarm' }) }, `Topla (süt ${st.sut ?? 0} · yumurta ${st.yumurta ?? 0} · yün ${st.yun ?? 0})`)));
  const kill = ANIMALS.filter((a) => a !== 'at' && hd[a] > 0); if (kill.length) box.append(h('div', { class: 'row' }, ...kill.map((a) => h('button', { class: 'danger sm', onclick: () => { if (confirm(`${ANIMAL_LABEL[a]} kesilsin mi?`)) void doAct({ t: 'slaughter', animal: a }); } }, `${ANIMAL_LABEL[a]} kes`))));
  return box;
}
const ANIMAL_ICON: Record<string, string> = { inek: 'cow', koyun: 'sheep', tavuk: 'chicken', at: 'horse' };
const ANIMAL_INFO: Record<string, string> = { inek: '3 süt/gün · 8 et', koyun: 'yün · 4 et', tavuk: '1 yumurta/gün', at: 'binek: %50 hızlı' };
function goalsBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', {}, h('h2', {}, '🎯 Hedefler ve görevler')); if (!m) return box;
  const ruler = w.kayzerId === m.id;
  if (!ruler) {
    if (m.goal) { const g = GOALS[m.goal]; const pr = Math.round(g.progress(w, m) * 100); box.append(h('div', { class: 'card' }, h('b', {}, g.label), h('div', { class: 'muted' }, g.desc), bar(pr, '#e8c14a'), h('small', {}, ` %${pr}`), h('div', { class: 'muted' }, `Ödül: “${g.title}” unvanı${g.reward ? ` + ${g.reward} Dinar` : ' + isyanda önderlik'}`))); }
    box.append(h('h3', {}, m.goal ? 'Hedefi değiştir' : 'Kişisel hedef seç'), h('div', { class: 'row' }, ...(Object.keys(GOALS) as GoalId[]).filter((g) => !(m.goalsDone ?? []).includes(g)).map((g) => h('button', { class: m.goal === g ? 'primary' : '', onclick: () => void send({ t: 'setGoal', goal: g }) }, GOALS[g].label))));
    if (m.goalsDone?.length) box.append(h('div', { class: 'muted' }, `Tamamlanan: ${m.goalsDone.map((g) => GOALS[g].title).join(', ')}`));
  }
  const ms = (w.missions ?? []).filter((x) => x.status === 'acik' || x.status === 'bildirildi');
  box.append(h('h3', {}, '👑 Kayzer’in görevleri'));
  if (!ms.length) box.append(h('div', { class: 'muted' }, 'Şu an açık görev yok.'));
  for (const x of ms) box.append(h('div', { class: 'card row' }, h('span', { class: 'grow' }, `“${x.text}” · ${x.reward} Dinar${x.to ? ` · ${findPerson(w, x.to)?.name ?? '?'} için` : ' · herkese açık'}${x.status === 'bildirildi' ? ` · ${findPerson(w, x.claimedBy)?.name ?? ''} bildirdi` : ''}`),
    ruler && x.status === 'bildirildi' ? h('span', {}, h('button', { class: 'primary', onclick: () => void send({ t: 'missionPay', id: x.id, pay: true }) }, '💰 Öde'), h('button', { onclick: () => void send({ t: 'missionPay', id: x.id, pay: false }) }, 'Reddet')) : '',
    !ruler && x.status === 'acik' && (!x.to || x.to === m.id) ? h('button', { onclick: () => void send({ t: 'missionClaim', id: x.id }) }, '✅ Tamamladım') : ''));
  if (ruler) {
    const t = h('input', { placeholder: 'Görev (ör. Limana 20 odun getir)' }); const r = h('input', { type: 'number', value: '50', style: 'width:80px' });
    const to = select([['', 'Herkese açık'], ...w.people.filter((p) => p.playerId && p.id !== m.id).map((p): [string, string] => [p.id, p.name])]);
    box.append(h('h3', {}, 'Yeni görev ver'), h('div', { class: 'row' }, t, r, to, h('button', { class: 'primary', onclick: () => void send({ t: 'missionCreate', text: t.value, reward: Number(r.value), to: to.value || null }) }, 'İlan et')));
  }
  return box;
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
  if (pendingSay) { inp.value = pendingSay; pendingSay = null; setTimeout(() => void sendMsg(), 50); }
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
    box.append(h('h3', {}, '⚠️ Oyunu sıfırla'), h('div', { class: 'muted' }, 'Tüm dünya baştan kurulur; oyuncu hesapları kalır, karakterler yeniden doğar. Önce otomatik yedek alınır.'),
      h('button', { class: 'danger', onclick: () => {
        if (!confirm('Oyunu sıfırlamak istediğinize emin misiniz? Bütün şehir, para, aileler ve olaylar silinecek.')) return;
        const t = prompt('Son onay: sıfırlamak için büyük harflerle SIFIRLA yazın'); if (t !== 'SIFIRLA') { toast('İptal edildi.'); return; }
        void run({ t: 'resetWorld', confirm: t });
      } }, '🔄 Oyunu sıfırla'));
    box.append(h('h3', {}, 'Yedekler (3 günde bir otomatik, son 8)'), h('button', { onclick: () => void run({ t: 'snapshot' }) }, 'Şimdi yedek al'), snapBox);
    return box;
  });
}

// ---------------- input: pan / zoom / tap ----------------
const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
let pinch: { d: number; z: number } | null = null;
/** Limited view: never more than ~30 tiles across (≈16 on a phone). */
function minZoom(): number { const tiles = innerWidth < 700 ? 16 : 30; return Math.max(1, canvas.width / (T * tiles)); }
function clampCam(): void {
  if (cam.z < minZoom()) cam.z = minZoom();
  const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T);
  const top = ((hudEl?.offsetHeight ?? 48) * (lowGfx ? 1 : window.devicePixelRatio || 1)) / (cam.z * T) + 2.2; // room above the top row so the info bar never hides buildings
  cam.x = Math.max(-2, Math.min(MAP_W - vw + 2, cam.x)); cam.y = Math.max(-top, Math.min(MAP_H - vh + 2, cam.y));
}
function zoomAt(sx: number, sy: number, nz: number): void {
  const z0 = cam.z; nz = Math.max(minZoom(), Math.min(6, nz));
  const wx = cam.x + sx / (z0 * T), wy = cam.y + sy / (z0 * T);
  cam.z = nz; cam.x = wx - sx / (nz * T); cam.y = wy - sy / (nz * T); clampCam();
}
function setupInput(): void {
  const dpr = (): number => (lowGfx ? 1 : window.devicePixelRatio || 1);
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; else { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam.z }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); zoomAt((a!.x + b!.x) / 2 * dpr(), (a!.y + b!.y) / 2 * dpr(), pinch.z * d / pinch.d); if (dragStart) dragStart.moved = true; return; }
    if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.abs(dx) + Math.abs(dy) > 6) { dragStart.moved = true; followCam = false; } cam.x = dragStart.cx - dx * dpr() / (cam.z * T); cam.y = dragStart.cy - dy * dpr() / (cam.z * T); clampCam(); }
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
        else if (hit.person && hit.person.id !== me()?.id) { const mq = placed.find((q) => q.p.id === me()?.id); const tq = placed.find((q) => q.p.id === hit.person!.id); if (!mq || !tq || Math.hypot(tq.x - mq.x, tq.y - mq.y) <= PERSON_REACH + 0.4) openPersonSheet(hit.person.id); else { closeSheet(); pending = null; openTries = 0; pendingOpen = hit.person.id; walkTo({ x: tq.x + 0.7, y: tq.y }); toast(`🚶 ${hit.person.name} yanına yürüyorsunuz…`); } }
        else if (hit.person) openMenu('ben');
        else if (hit.building) { const b = hit.building; selected = null; pending = null; walkTo(doorSpot(b)); sfx('door'); openSheet(() => bPanel(b)); }
        else { pending = null; pendingOpen = null; closeSheet(); walkTo({ x: tx, y: ty }); sfx('step'); }
      }
      dragStart = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr(), cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const resize = (): void => { canvas.width = Math.round(innerWidth * dpr()); canvas.height = Math.round(innerHeight * dpr()); const want = canvas.width / (T * (innerWidth < 700 ? 12 : 22)); if (cam.z < want) cam.z = want; clampCam(); };
  addEventListener('resize', resize); resize();
}

function darkness(w: World): number {
  const t = w.hour; if (t >= 21 || t < 5) return 0.45; if (t >= 19) return (t - 19) / 2 * 0.45; if (t < 7) return (7 - t) / 2 * 0.45; return 0;
}

let lastHud = 0; let lastDraw = 0; let lastFrame = performance.now();
/** v1.9 NPC smoothing: the schedule/path target is computed from (server) time every frame; what we DRAW follows it
 * with a time-based critically-damped chase, so snapshot corrections, schedule switches and overrides never snap. */
const shown = new Map<string, { x: number; y: number; vx: number; vy: number; dir: number; t: number }>();
function smoothPeople(list: Placed[], mine: string | null): Placed[] {
  const t = performance.now();
  for (const q of list) {
    if (q.p.id === mine) continue; // own character: local prediction already
    const s = shown.get(q.p.id);
    if (!s || !q.visible || t - s.t > 1500 || Math.hypot(q.x - s.x, q.y - s.y) > 8) { shown.set(q.p.id, { x: q.x, y: q.y, vx: 0, vy: 0, dir: q.dir, t }); continue; }
    const dt = Math.min(0.1, (t - s.t) / 1000); s.t = t;
    const w0 = 7; // spring stiffness (critically damped)
    const ax = w0 * w0 * (q.x - s.x) - 2 * w0 * s.vx, ay = w0 * w0 * (q.y - s.y) - 2 * w0 * s.vy;
    s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const sp = Math.hypot(s.vx, s.vy); if (sp > 0.25 && Math.abs(s.vx) > 0.15) s.dir = s.vx > 0 ? 1 : -1;
    q.x = s.x; q.y = s.y; q.moving = q.moving || sp > 0.4; if (sp > 0.25) q.dir = s.dir;
  }
  return list;
}
function frame(): void {
  const pf = performance.now(); if (lowGfx && pf - lastDraw < 32) { requestAnimationFrame(frame); return; } lastDraw = pf;
  if (world && stat) {
    const now = gameNow();
    const meP0 = me(); placed = smoothPeople(placePeople(world, now), meP0?.id ?? null);
    const meP = meP0; const mq = meP ? placed.find((q) => q.p.id === meP.id) : undefined;
    const dt = Math.min(0.1, (performance.now() - lastFrame) / 1000); lastFrame = performance.now();
    if (mq && followCam && !dragStart) { const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T); const tx = mq.x - vw / 2, ty = mq.y - vh / 2 - 0.5; const k = Math.min(1, dt * 6); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; clampCam(); }
    if (pendingOpen && mq) { const tq = placed.find((q) => q.p.id === pendingOpen); if (!tq) pendingOpen = null; else if (Math.hypot(tq.x - mq.x, tq.y - mq.y) <= PERSON_REACH + 0.4 || (openTries >= 2 && meP?.walk && now > walkEnd(meP.walk) && Math.hypot(tq.x - mq.x, tq.y - mq.y) <= PERSON_REACH + 0.85)) { const id = pendingOpen; pendingOpen = null; walkTarget = null; openPersonSheet(id); } else if (meP?.walk && now > walkEnd(meP.walk) - 200) { openTries += 1; walkTo({ x: tq.x + (openTries % 2 ? 0.7 : -0.7), y: tq.y + (openTries > 2 ? 0.6 : 0) }); if (openTries > 8) pendingOpen = null; } }
    drawFrame(ctx2d, stat, world, cam, placed, now, selected, me()?.id ?? null, lowGfx ? 0 : darkness(world), walkTarget);
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
    if (world.serverNow) { const ns = world.serverNow - Date.now(); skew = first || Math.abs(ns - skew) > 3000 ? ns : skew + (ns - skew) * 0.15; } // smooth clock: no jumps
    const mm = me(); if (localWalk && mm && mm.id === localWalk.id && gameNow() < walkEnd(localWalk.walk) + 15_000) mm.walk = localWalk.walk;
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

// ---------------- the Kayzer's citizen register (only at the Saray) ----------------
let citSort: string = 'name'; let citDir = 1; let citFilter = ''; let citProf = '';
function openCitizens(): void {
  openSheet(() => {
    const w = world!; const box = h('div', {}, h('h2', {}, '📋 Vatandaş defteri'));
    if (!atSaray()) { box.append(h('div', { class: 'muted' }, 'Defter Saray’da durur. Saray’a yürüyün.')); return box; }
    const now = gameNow(); const pos = new Map(placed.map((q) => [q.p.id, q]));
    const where = (p: Person): string => { if (p.jailedDays > 0) return 'Zindan/gözaltı'; const q = pos.get(p.id); if (!q || !q.visible) return 'Evinde'; const b = w.buildings.map((x) => ({ x, d: distToBuilding(x, q) })).sort((a, c) => a.d - c.d)[0]; return b && b.d < 4 ? b.x.name : 'Sokakta'; };
    const cols: [string, string, (p: Person) => number | string][] = [['name', 'İsim', (p) => p.name], ['prof', 'Meslek', (p) => PROF_LABEL[p.prof]], ['health', '❤️', (p) => p.health], ['mood', '😊', (p) => p.mood], ['loyalty', '🤝', (p) => p.loyalty], ['din', '🕌', (p) => p.din], ['republic', '🗽', (p) => p.republic], ['money', '👛', (p) => p.money], ['where', '📍', where]];
    const q = h('input', { placeholder: 'İsim ara…', value: citFilter }); q.addEventListener('input', () => { citFilter = q.value; rerenderSheet(true); setTimeout(() => { const i = sheet?.querySelector('input'); if (i) { (i as HTMLInputElement).focus(); (i as HTMLInputElement).setSelectionRange(citFilter.length, citFilter.length); } }, 0); });
    const pf = select([['', 'Tüm meslekler'], ...[...new Set(w.people.map((p) => p.prof))].map((p): [string, string] => [p, PROF_LABEL[p]])]); pf.value = citProf; pf.addEventListener('change', () => { citProf = pf.value; rerenderSheet(true); });
    let list = w.people.filter((p) => p.prof !== 'naip' && (!citFilter || p.name.toLocaleLowerCase('tr').includes(citFilter.toLocaleLowerCase('tr'))) && (!citProf || p.prof === citProf));
    const col = cols.find((c) => c[0] === citSort)!; list = list.sort((a, b) => { const x = col[2](a), y = col[2](b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * citDir; });
    const avg = (f: (p: Person) => number): number => Math.round(list.reduce((s, p) => s + f(p), 0) / Math.max(1, list.length));
    box.append(h('div', { class: 'row' }, q, pf), h('div', { class: 'muted' }, `${list.length} kişi · ort. sağlık ${avg((p) => p.health)} · mutluluk ${avg((p) => p.mood)} · sadakat ${avg((p) => p.loyalty)} · cumhuriyetçilik ${avg((p) => p.republic)}`));
    const t = h('table', { class: 'citizens' }, h('tr', {}, ...cols.map(([k, l]) => h('th', { style: 'cursor:pointer', onclick: () => { if (citSort === k) citDir = -citDir; else { citSort = k; citDir = k === 'name' || k === 'prof' || k === 'where' ? 1 : -1; } rerenderSheet(true); } }, `${l}${citSort === k ? (citDir > 0 ? ' ▲' : ' ▼') : ''}`))));
    for (const p of list) t.append(h('tr', { style: 'cursor:pointer', onclick: () => openPersonSheet(p.id) }, h('td', {}, `${p.name}${p.playerId && !p.npc ? ' 🎮' : ''}`), h('td', {}, PROF_LABEL[p.prof]),
      ...(['health', 'mood', 'loyalty', 'din', 'republic'] as const).map((k) => h('td', {}, bar(p[k], k === 'health' ? '#c8483a' : k === 'republic' ? '#4a7fd4' : k === 'loyalty' ? '#e8c14a' : k === 'din' ? '#8a6fd1' : '#5fae5a'), h('small', {}, ` ${Math.round(p[k])}`))),
      h('td', {}, fmt(p.money)), h('td', {}, where(p))));
    void now; box.append(h('div', { style: 'overflow:auto;max-height:60vh' }, t)); return box;
  });
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
    h('table', { class: 'sign' }, row('aday', '1. Adaylık', `${Math.max(1, d.adayFrom)}–${d.adayTo}. gün (Meclis’e gidip aday olun)`), row('propaganda', '2. Propaganda', `${d.propFrom}–${d.propTo}. gün (afiş, meydan konuşması)`), row('oylama', '3. Seçim', `${d.vote}. gün (Meclis ya da Meydan’daki sandık)`)),
    h('div', { class: 'muted' }, `Askerler ve bekçiler aday olamaz. ${w.election.seats} sandalye. Adaylar: ${w.election.candidates.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ') || 'henüz yok'}.`));
}
function openElectionSign(): void { openSheet(() => h('div', { class: 'stack' }, electionInfo(world!), electionCard(ctx()))); }
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
let trialEl: HTMLElement | null = null; const trialSeen = new Set<string>((localStorage.getItem('imp-trial-seen') ?? '').split(',').filter(Boolean));
const tKey = (id: string): string => `${world?.seed ?? 0}:${id}`; // case ids restart after a reset
const markSeen = (id: string): void => { trialSeen.add(tKey(id)); localStorage.setItem('imp-trial-seen', [...trialSeen].slice(-60).join(',')); };
function trialPopup(): void {
  const w = world; const m = me(); if (!w || !m) return;
  const c: CourtCase | undefined = w.cases.find((x) => x.trial && (x.accusedId === m.id || x.trial.judgeId === m.id || x.trial.prosecutorId === m.id) && (!x.trial.done || (!trialSeen.has(tKey(x.id)) && x.stage !== 'kapandi' ? true : !trialSeen.has(tKey(x.id)) && gameNow() - (x.trial.doneAt ?? 0) < 120_000)) && !(x.trial.done && x.verdict === 'dusuruldu' && x.sentence?.startsWith('Aynı olay')));
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
    tr.done ? h('div', { class: 'card verdict' }, h('b', {}, tr.verdictText ?? 'Karar verildi.'), h('div', { style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: () => { markSeen(c.id); trialEl?.remove(); trialEl = null; } }, 'Tamam')))
      : c.accusedId === m.id ? h('div', {}, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void go() }, 'Savun')), h('div', { class: 'row' }, h('span', { class: 'muted' }, `Kalan süre ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · en fazla 5 söz`), h('button', { onclick: () => void send({ t: 'restCase', caseId: c.id }) }, 'Savunmam bitti, karar verilsin')))
        : h('div', { class: 'muted' }, 'Duruşmayı izliyorsunuz.'));
  const wasDone = trialEl?.dataset.done === '1';
  const el = h('div', { class: 'modal trial-modal' }, box); el.dataset.done = tr.done ? '1' : '0';
  if (trialEl) trialEl.replaceWith(el); else { app.append(el); sfx('gavel'); }
  trialEl = el; if (tr.done && !wasDone) sfx('gavel');
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
}
void ({} as Corpse);

installIconify();
void be.restore().then((s) => (s ? start() : loginScreen()));
// expose for headless smoke tests
(window as unknown as { __imp: () => unknown }).__imp = () => ({ mute: setMuted, look: (x: number, y: number) => { followCam = false; cam.x = x - canvas.width / (cam.z * T) / 2; cam.y = y - canvas.height / (cam.z * T) / 2; }, act: doAct, openB: (id: string) => { const b = world!.buildings.find((x) => x.id === id); if (b) openSheet(() => bPanel(b)); }, menu: openMenu, admin: openAdmin, world, me: me()?.name, goods: GOODS.map((g) => GOOD_LABEL[g]), avatar: !!avatar, placed: placed.map((q) => [q.p.id, q.x, q.y, q.visible]), toScreen: (x: number, y: number) => { const r = canvas.getBoundingClientRect(); return [r.left + (x - cam.x) * cam.z * T / (lowGfx ? 1 : window.devicePixelRatio || 1), r.top + (y - cam.y) * cam.z * T / (lowGfx ? 1 : window.devicePixelRatio || 1)]; } });

// ---- v1.9 landscape: rotate overlay (phones in portrait) + low-graphics class ----
document.body.classList.toggle('low', lowGfx);
document.body.append(h('div', { class: 'rotate-ov' }, ic('phone'), h('b', {}, 'Telefonu yatay çevirin'), h('div', { class: 'muted' }, 'İmparatorluk yatay ekranda oynanır.')));
try { void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); } catch { /* only in fullscreen / installed PWA */ }
// ---- v1.8 PWA: service worker (static only) + "Ana ekrana ekle" hint ----
if ('serviceWorker' in navigator && location.protocol === 'https:') void navigator.serviceWorker.register('./sw.js').catch(() => {});
let installEvt: (Event & { prompt?: () => void }) | null = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; showInstallHint(); });
function showInstallHint(): void {
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone;
  if (standalone || localStorage.getItem('imp-a2hs') === '1' || document.querySelector('.a2hs')) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); if (!ios && !installEvt) return;
  const close = (): void => { localStorage.setItem('imp-a2hs', '1'); el.remove(); };
  const el = h('div', { class: 'a2hs' }, ios ? 'Tam ekran için: Safari’de Paylaş → “Ana Ekrana Ekle”.' : 'Oyunu ana ekrana ekleyip tam ekran oynayabilirsiniz.',
    !ios && installEvt ? h('button', { class: 'primary', onclick: () => { installEvt?.prompt?.(); close(); } }, 'Ana ekrana ekle') : '', h('button', { onclick: close }, '✕'));
  document.body.append(el); setTimeout(close, 15000);
}
setTimeout(showInstallHint, 8000);
